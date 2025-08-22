import express from 'express';
import cors from 'cors';
import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;

// Initialize HuggingFace inference client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Model endpoints
const MODELS = {
  toxic: "unitary/unbiased-toxic-roberta",
  offensive: "cardiffnlp/twitter-roberta-base-offensive",
  sentiment: "cardiffnlp/twitter-roberta-base-sentiment-latest",
  flanT5: "google/flan-t5-base" // Using base model for faster inference
};

// Fix the loadPromptTemplate function
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

// Get the prompt template
const PROMPT_TEMPLATE = loadPromptTemplate();

/**
 * Analyze toxicity using the unbiased-toxic-roberta model
 */
async function analyzeToxicity(text) {
  try {
    const result = await hf.textClassification({
      model: MODELS.toxic,
      inputs: text
    });
    
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
    const result = await hf.textClassification({
      model: MODELS.offensive,
      inputs: text
    });
    
    // Find the offensive label
    const offensiveLabel = result.find(item => item.label === 'offensive');
    return {
      score: offensiveLabel ? offensiveLabel.score : 0,
      isOffensive: offensiveLabel ? offensiveLabel.score > 0.5 : false
    };
  } catch (error) {
    console.error('Offensive language analysis error:', error);
    return { score: 0, isOffensive: false };
  }
}

/**
 * Analyze sentiment using twitter-roberta-base-sentiment
 */
async function analyzeSentiment(text) {
  try {
    const result = await hf.textClassification({
      model: MODELS.sentiment,
      inputs: text
    });
    
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
    // Use the prompt template from PROMPT.md
    const prompt = PROMPT_TEMPLATE
      .replace('{length}', originalLength)
      .replace('{input}', text);
    
    console.log('Sending prompt to FLAN-T5:', prompt); // Add logging
    
    const result = await hf.textGeneration({
      model: MODELS.flanT5,
      inputs: prompt,
      parameters: {
        max_new_tokens: Math.min(originalLength * 2, 200),
        temperature: 0.7,
        do_sample: true,
        top_p: 0.9
      }
    });
    
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

// POST /analyze endpoint
app.post('/analyze', async (req, res) => {
  console.log('Received analyze request:', {
    text: req.body.text,
    hasBody: !!req.body,
    contentType: req.headers['content-type']
  });
  
  debugHuggingFace();

  try {
    const { text, context = {}, prefs = {} } = req.body || {};
    
    if (!text || typeof text !== 'string') {
      console.log('Invalid text input');
      return res.status(400).json({ ok: false, error: 'Missing text' });
    }

    // Test HuggingFace connection
    try {
      console.log('Testing toxic model...');
      const testResult = await hf.textClassification({
        model: MODELS.toxic,
        inputs: 'test message'
      });
      console.log('Test result:', testResult);
    } catch (hfError) {
      console.error('HuggingFace test failed:', hfError);
      throw new Error(`HuggingFace API error: ${hfError.message}`);
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

// Simple health check
app.get('/', (req, res) => res.send('Friendly Lago AI backend running.'));

// Model status endpoint
app.get('/status', async (req, res) => {
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
        template: PROMPT_TEMPLATE
      },
      status: 'operational'
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Status check failed' });
  }
});

// Prompt template endpoint
app.get('/prompt', (req, res) => {
  try {
    res.json({
      ok: true,
      prompt: {
        source: 'PROMPT.md',
        template: PROMPT_TEMPLATE,
        parameters: ['${originalLength}', '${text}']
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Prompt retrieval failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Friendly Lago AI backend listening on :${PORT}`);
  console.log('Using models:');
  console.log(`- Toxicity: ${MODELS.toxic}`);
  console.log(`- Offensive: ${MODELS.offensive}`);
  console.log(`- Sentiment: ${MODELS.sentiment}`);
  console.log(`- Rewriting: ${MODELS.flanT5}`);
});

// Add this debug function
function debugHuggingFace() {
  console.log('HuggingFace API Key:', process.env.HUGGINGFACE_API_KEY ? 'Present' : 'Missing');
  console.log('HF Client:', hf ? 'Initialized' : 'Failed');
}