import express from 'express';
import cors from 'cors';
import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;
const API_VERSION = 'v1';

// Model endpoints
const MODELS = {
  toxic: "unitary/unbiased-toxic-roberta",
  offensive: "cardiffnlp/twitter-roberta-base-offensive",
  sentiment: "cardiffnlp/twitter-roberta-base-sentiment-latest",
  flanT5: "google/flan-t5-small" // Using base model for faster inference
};

// Cache mechanism for prompt template
let cachedPromptTemplate = null;
let lastPromptLoad = 0;
const PROMPT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function loadPromptTemplate() {
  try {
    const promptPath = path.join(process.cwd(), 'PROMPT.md');
    const promptContent = fs.readFileSync(promptPath, 'utf8');
    
    // Extract the prompt template from the markdown file
    const promptMatch = promptContent.match(/```\s*\n([\s\S]*?)\n```/);
    if (promptMatch) {
      return promptMatch[1].trim();
    }
    
    // Fallback to default prompt if parsing fails
    console.warn('Could not parse prompt from PROMPT.md, using default');
    return `Rewrite this comment to be kinder and more inclusive while maintaining the same meaning, 
same commenter tone, and similar length (around {length} words). 
Focus only on changing the offensive part of the comment, not the entire comment: "{input}"`;
  } catch (error) {
    console.error('Could not load PROMPT.md:', error);
    return `Rewrite this comment to be kinder and more inclusive while maintaining the same meaning, 
same commenter tone, and similar length (around {length} words). 
Focus only on changing the offensive part of the comment, not the entire comment: "{input}"`;
  }
}

function getPromptTemplate() {
  const now = Date.now();
  if (cachedPromptTemplate && (now - lastPromptLoad) < PROMPT_CACHE_TTL) {
    return cachedPromptTemplate;
  }
  cachedPromptTemplate = loadPromptTemplate();
  lastPromptLoad = now;
  return cachedPromptTemplate;
}

// Initialize the prompt template
const PROMPT_TEMPLATE = getPromptTemplate();

/**
 * Analyze toxicity using the unbiased-toxic-roberta model
 */
async function analyzeToxicity(text) {
  try {
    const result = await withTimeout(
      hf.textClassification({
        model: MODELS.toxic,
        inputs: text
      }),
      10000 // 10 second timeout
    );
    
    console.log('Toxicity analysis result:', result); // Add logging
    
    // Find the toxic label
    const toxicLabel = result.find(item => item.label === 'toxic');
    return {
      score: toxicLabel ? toxicLabel.score : 0,
      isToxic: toxicLabel ? toxicLabel.score > 0.5 : false
    };
  } catch (error) {
    console.error('Toxicity analysis error:', error);
    throw error; // Throw the error instead of silently failing
  }
}

/**
 * Analyze offensive language using twitter-roberta-base-offensive
 */
async function analyzeOffensiveLanguage(text) {
  try {
    const result = await withTimeout(
      hf.textClassification({
        model: MODELS.offensive,
        inputs: text
      }),
      10000
    );
    
    const offensiveLabel = result.find(item => item.label === 'offensive');
    if (!offensiveLabel) {
      throw new Error('Unexpected model response format');
    }
    
    return {
      score: offensiveLabel.score,
      isOffensive: offensiveLabel.score > 0.5
    };
  } catch (error) {
    console.error('Offensive language analysis error:', error);
    throw error; // Consistent with other analysis functions
  }
}

/**
 * Analyze sentiment using twitter-roberta-base-sentiment
 */
async function analyzeSentiment(text) {
  try {
    const result = await withTimeout(
      hf.textClassification({
        model: MODELS.sentiment,
        inputs: text
      }),
      10000
    );
    
    // Find the highest scoring sentiment
    const topSentiment = result.reduce((prev, current) => 
      (prev.score > current.score) ? prev : current
    );
    
    return {
      label: topSentiment.label,
      score: topSentiment.score,
      isPositive: topSentiment.label === 'positive',
      isNegative: topSentiment.label === 'negative',
      isNeutral: topSentiment.label === 'neutral'
    };
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return { label: 'neutral', score: 0, isPositive: false, isNegative: false, isNeutral: true };
  }
}

/**
 * Generate a kinder rewrite using FLAN-T5
 */
async function generateRewrite(text, originalLength) {
  try {
    // Use the prompt template from PROMPT.md. Fetch the template on demand
    // to honour cache TTL and avoid stale data.
    const promptTemplate = getPromptTemplate();
    const prompt = promptTemplate
      .replace('{length}', originalLength)
      .replace('{input}', text);
    
    console.log('Sending prompt to FLAN-T5:', prompt); // Add logging
    
    const result = await withTimeout(
      hf.textGeneration({
        model: MODELS.flanT5,
        inputs: prompt,
        parameters: {
          max_new_tokens: Math.min(originalLength * 2, 200),
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9
        }
      }),
      15000  // Longer timeout for generation
    );
    
    console.log('FLAN-T5 response:', result); // Add logging
    return result.generated_text.trim();
  } catch (error) {
    console.error('Rewrite generation error:', error);
    throw error; // Throw the error instead of returning null
  }
}

/**
 * Determine severity based on multiple model outputs
 */
function determineSeverity(toxicityScore, offensiveScore) {
  const maxScore = Math.max(toxicityScore, offensiveScore);
  
  if (maxScore >= 0.8) return 'high';
  if (maxScore >= 0.6) return 'medium';
  if (maxScore >= 0.4) return 'low';
  return 'none';
}

/**
 * Analyze a comment using all models and generate response
 */
async function analyzeComment({ text, prefs = {} }) {
  console.log('Starting analysis for:', text);
  
  try {
    // Run all analyses in parallel
    console.log('Running model analysis...');
    const [toxicity, offensive, sentiment] = await Promise.all([
      analyzeToxicity(text).catch(err => {
        console.error('Toxicity analysis failed:', err);
        throw err;
      }),
      analyzeOffensiveLanguage(text).catch(err => {
        console.error('Offensive analysis failed:', err);
        throw err;
      }),
      analyzeSentiment(text).catch(err => {
        console.error('Sentiment analysis failed:', err);
        throw err;
      })
    ]);
    
    console.log('Analysis results:', { toxicity, offensive, sentiment });
    
    // Determine overall classification
    const isOffensive = toxicity.isToxic || offensive.isOffensive;
    const severity = determineSeverity(toxicity.score, offensive.score);
    
    const classification = {
      is_offensive: isOffensive,
      severity,
      categories: [],
      reasons: []
    };
    
    // Add specific reasons
    if (toxicity.isToxic) {
      classification.categories.push('toxic');
      classification.reasons.push(`Toxicity detected (${(toxicity.score * 100).toFixed(1)}%)`);
    }
    
    if (offensive.isOffensive) {
      classification.categories.push('offensive');
      classification.reasons.push(`Offensive language detected (${(offensive.score * 100).toFixed(1)}%)`);
    }
    
    if (sentiment.isNegative) {
      classification.categories.push('negative_sentiment');
      classification.reasons.push(`Negative sentiment detected (${(sentiment.score * 100).toFixed(1)}%)`);
    }
    
    const suggestions = [];
    
    if (!isOffensive) {
      // Message is already friendly
      suggestions.push({ 
        label: 'Original', 
        text: text, 
        notes: 'No offensive language detected.' 
      });
      
      return {
        classification,
        suggestions,
        final_suggestion: text,
        tone_applied: prefs.tone || 'match-writer',
        needs_clarification: false,
        clarifying_question: '',
        notes: 'Your comment is already kind and inclusive!'
      };
    }
    
    // Generate kinder rewrite
    const originalLength = text.split(' ').length;
    const rewritten = await generateRewrite(text, originalLength);
    
    if (rewritten) {
      suggestions.push({ 
        label: 'Friendly rewrite', 
        text: rewritten, 
        notes: 'AI-generated kinder version maintaining your original meaning.' 
      });
      
      return {
        classification,
        suggestions,
        final_suggestion: rewritten,
        tone_applied: prefs.tone || 'polite',
        needs_clarification: false,
        clarifying_question: '',
        notes: `Rewritten to be more inclusive while preserving your ${sentiment.label} sentiment.`
      };
    } else {
      // Fallback if AI rewrite fails
      const fallbackText = text.replace(/\b(bad|terrible|awful|horrible)\b/gi, 'concerning');
      suggestions.push({ 
        label: 'Simplified version', 
        text: fallbackText, 
        notes: 'Basic rewrite due to AI model unavailability.' 
      });
      
      return {
        classification,
        suggestions,
        final_suggestion: fallbackText,
        tone_applied: prefs.tone || 'polite',
        needs_clarification: false,
        clarifying_question: '',
        notes: 'Basic rewrite applied. Consider rephrasing manually for better results.'
      };
    }
    
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}

// Use permissive CORS and JSON body parsing
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// Add the rate limiter configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { ok: false, error: 'Too many requests, please try again later.' }
});

// Apply rate limiting to all routes
app.use(limiter);

// Add request validation middleware
const validateAnalyzeRequest = [
  body('text').isString().trim().isLength({ min: 1, max: 1000 }),
  body('prefs').optional().isObject(),
  body('context').optional().isObject(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, errors: errors.array() });
    }
    next();
  }
];

// Add version prefix to all routes
const apiRouter = express.Router();

// Use versioned routes
app.use(`/api/${API_VERSION}`, apiRouter);

app.listen(PORT, () => {
  console.log(`Friendly Iago AI backend listening on :${PORT}`);
  console.log('Using models:');
  console.log(`- Toxicity: ${MODELS.toxic}`);
  console.log(`- Offensive: ${MODELS.offensive}`);
  console.log(`- Sentiment: ${MODELS.sentiment}`);
  console.log(`- Rewriting: ${MODELS.flanT5}`);
});

// Add timeout wrapper
const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), ms);
  });
  return Promise.race([promise, timeout]);
};

// Debug function for HuggingFace
function debugHuggingFace() {
  console.log('HuggingFace API Key:', process.env.HUGGINGFACE_API_KEY ? 'Present' : 'Missing');
  console.log('HF Client:', hf ? 'Initialized' : 'Failed');
}

// HuggingFace health check
async function checkHuggingFaceHealth() {
  try {
    await withTimeout(
      hf.textClassification({
        model: MODELS.toxic,
        inputs: 'test'
      }),
      5000 // 5 second timeout
    );
    return true;
  } catch (error) {
    console.error('HuggingFace health check failed:', error);
    return false;
  }
}

// Enhanced health check endpoint
apiRouter.get('/health', async (req, res) => {
  const hfStatus = await checkHuggingFaceHealth();
  const promptStatus = !!getPromptTemplate();
  
  const health = {
    ok: hfStatus && promptStatus,
    services: {
      huggingface: {
        status: hfStatus ? 'operational' : 'failed',
        models: MODELS
      },
      prompt: {
        status: promptStatus ? 'operational' : 'failed',
        lastUpdate: lastPromptLoad
      }
    },
    version: API_VERSION,
    uptime: process.uptime()
  };
  
  res.status(health.ok ? 200 : 503).json(health);
});

apiRouter.post('/analyze', validateAnalyzeRequest, async (req, res) => {
  const text = (req.body.text || '').trim();
  debugHuggingFace();

  try {
    const { context = {}, prefs = {} } = req.body || {};
    
    if (!text || typeof text !== 'string') {
      console.log('Invalid text input');
      return res.status(400).json({ ok: false, error: 'Missing text' });
    }

    console.log('Analyzing comment...');
    const data = await analyzeComment({ text, prefs });
    console.log('Analysis complete:', data);
    
    return res.json({ ok: true, data });
    
  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(500).json({ 
      ok: false, 
      error: error.message || 'Internal server error',
      details: error.stack
    });
  }
});

apiRouter.get('/status', async (req, res) => {
  try {
    res.json({
      ok: true,
      models: {
        toxic: MODELS.toxic,
        offensive: MODELS.offensive,
        sentiment: MODELS.sentiment,
        flanT5: MODELS.flanT5
      },
      prompt: {
        source: 'PROMPT.md',
        // Always fetch the latest template rather than using a stale global
        template: getPromptTemplate()
      },
      status: 'operational'
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Status check failed' });
  }
});

apiRouter.get('/prompt', (req, res) => {
  try {
    // Return the current prompt template and the expected parameter placeholders.
    res.json({
      ok: true,
      prompt: {
        source: 'PROMPT.md',
        template: getPromptTemplate(),
        // The template expects two parameters: {length} and {input}
        parameters: ['{length}', '{input}']
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Prompt retrieval failed' });
  }
});

// Add a redirect from root to versioned API
app.get('/', (req, res) => {
  res.redirect(`/api/${API_VERSION}/health`);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    ok: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    requestId: req.id
  });
});
