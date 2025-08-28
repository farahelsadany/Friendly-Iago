## Overview
Friendly Iago helps your comments **land with kindness** without changing your stance. It uses **HuggingFace models** to detect toxicity, offensive language, and sentiment, then generates gentler alternatives with Google’s FLAN-T5.

## Models Used

1. **Toxic Comment Classification**: `unitary/unbiased-toxic-roberta`
   - Detects toxic content in comments
   - Provides confidence scores for toxicity levels

2. **Offensive Language Identification**: `cardiffnlp/twitter-roberta-base-offensive`
   - Identifies offensive language patterns
   - Works well with social media style text

3. **Sentiment Analysis**: `cardiffnlp/twitter-roberta-base-sentiment-latest`
   - Analyzes emotional tone (positive/negative/neutral)
   - Helps understand the context of the comment

4. **Comment Rewriting**: `google/flan-t5-small`
   - Generates kinder, more inclusive alternatives using the smaller FLAN-T5 model for faster responses
   - Maintains original meaning while improving tone
   - Preserves similar length to the original
   - Handles tricky cases like positive expletives by keeping positive sentiment intact

## Core Principles

### 1. **Preserve the user's point and stance**
   - Does not change the position or meaning—only the delivery
   - Keeps the core argument intact

### 2. **Avoid appearance talk**
   - Redirects to behavior/ideas instead of physical attributes
   - Focuses on actions and consequences

### 3. **Reduce harm**
   - Removes insults, slurs, harassment
   - Eliminates identity-based attacks and threats
   - Avoids body-shaming language

### 4. **Respect free expression**
   - Keeps critique intact but constructive
   - Maintains the user's right to express opinions

### 5. **Tone & length matching**
   - Matches requested tone when specified
   - Prefers one-liners, then short (≤40 words), then medium (≤80 words)
   - Maintains similar length to original input

### 6. **Voice preservation**
   - Keeps user's slang/stylistic quirks if requested
   - Maintains the commenter's unique tone

### 7. **Context-aware analysis**
   - Uses post text, nearby comments, images (alt/URLs)
   - Considers author handle and site norms
   - Adapts to the specific platform context

### 8. **Clarification when helpful**
   - If a brief question could improve the rewrite, the model asks **one** short clarifying question
   - Keeps questions focused and actionable

## Setup

1. **Install dependencies**:
   ```bash
   npm install
````

2. **Get HuggingFace API Key**:

   * Go to [HuggingFace Settings](https://huggingface.co/settings/tokens)
   * Create a new access token
   * Copy the token

3. **Create environment file**:

   ```bash
   cp env-template.txt .env
   ```

   Then edit `.env` and add your HuggingFace API key:

   ```
   HUGGINGFACE_API_KEY=your_actual_api_key_here
   ```

4. **Start the server**:

   ```bash
   npm start
   ```

## API Endpoints

### POST /api/v1/analyze

Analyzes a comment and provides suggestions. All endpoints are versioned under `/api/v1`.

**Request Body**:

```json
{
  "text": "Your comment here",
  "prefs": {
    "tone": "polite",
    "length": "similar"
  }
}
```

**Response**:

```json
{
  "ok": true,
  "data": {
    "classification": {
      "is_offensive": false,
      "severity": "none",
      "categories": [],
      "reasons": []
    },
    "suggestions": [...],
    "final_suggestion": "Your comment is already kind!",
    "tone_applied": "polite",
    "notes": "Your comment is already kind and inclusive!"
  }
}
``'





### GET /api/v1/status

Check the status of all AI models and view the current prompt template. Returns the models being used and the current prompt loaded from `PROMPT.md`.

### GET /api/v1/prompt

View the current prompt template being used by the FLAN‑T5 model. This endpoint reflects the cached prompt from `PROMPT.md`; the server refreshes this cache every 5 minutes.

### GET /api/v1/health

Health check endpoint. Returns the operational status of the HuggingFace models and the prompt loader. The root `/` path simply redirects to this health endpoint.

## Output Schema

### Classification Object

```json
{
  "is_offensive": boolean,
  "severity": "none" | "low" | "medium" | "high",
  "categories": string[],
  "reasons": string[]
}
```

### Suggestions Array

```json
[
  {
    "label": "Direct but respectful",
    "text": "...",
    "notes": "..."
  },
  {
    "label": "Supportive critique", 
    "text": "...",
    "notes": "..."
  }
]
```

### Complete Response

```json
{
  "classification": {...},
  "suggestions": [...],
  "final_suggestion": "...",
  "tone_applied": "supportive | polite | professional | firm-but-kind | concise | match-writer",
  "needs_clarification": boolean,
  "clarifying_question": "string",
  "notes": "Optional brief notes on how context changed the rewrite."
}
```

## Input Payload Structure

### Required Fields

```json
{
  "text": "string (required)",
  "prefs": {
    "tone": "match-writer|supportive|polite|professional|firm-but-kind|concise",
    "length": "one-liner|short|medium|similar",
    "keep_slang": boolean,
    "strictness": "low|medium|high"
  }
}
```

### Optional Context Fields

```json
{
  "context": {
    "site": "string|null",
    "url": "string|null", 
    "post_text": "string",
    "nearby_comments": ["..."],
    "images": [{"alt": "string", "src": "url|null"}],
    "author": "string|null"
  },
  "user_style_examples": ["..."],
  "instruction": "extra guidance from the user",
  "clarifying_answer": "short answer if a question was asked"
}
```

## How It Works

1. **Input Analysis**: The comment is analyzed by all three classification models simultaneously
2. **Severity Assessment**: Combines scores from toxicity and offensive models to determine overall severity
3. **Rewrite Generation**: If offensive content is detected, FLAN-T5 generates a kinder alternative
4. **Length Preservation**: The AI model is instructed to maintain similar length to the original
5. **Fallback Handling**: If AI generation fails, provides basic word replacement as backup

## Prompt System

The backend reads its rewrite instructions from `PROMPT.md` and caches the result for five minutes. This allows you to:

* **Modify prompts without restarting**: Edit the `PROMPT.md` file and the changes will take effect automatically after the cache expires (up to five minutes)
* **Version control prompts**: Track prompt changes in your git repository
* **A/B test prompts**: Easily switch between different prompt versions and have them picked up without downtime

### Prompt Parameters

The prompt template supports these variables:

* `{length}`: Automatically replaced with the word count of the original comment
* `{input}`: Automatically replaced with the original comment text

### Modifying Prompts

To change the prompt:

1. Edit the `PROMPT.md` file
2. Update the prompt text within the code block (between \`\`\` marks)
3. Save the file
4. The new prompt will be picked up automatically after the five‑minute cache expires; no server restart is needed

### Prompt Endpoints

* **GET /api/v1/prompt**: View the current prompt template and parameters. This endpoint returns the cached prompt and the names of the placeholders.
* **GET /api/v1/status**: Check model status and see which prompt is currently loaded. Includes details about each model and the prompt cache timestamp.

## Implementation Notes

### HuggingFace Approach (Current)

* **Parallel Processing**: All classification models run simultaneously for efficiency
* **Score Aggregation**: Combines multiple model outputs for better accuracy
* **Fallback Handling**: Graceful degradation if AI models are unavailable
* **Length Preservation**: FLAN-T5 is specifically instructed to maintain similar length

### GPT Approach (Alternative)

* **Single Model**: Uses one large language model for all tasks
* **Contextual Understanding**: Better grasp of nuanced language and context
* **Flexible Prompts**: Can handle complex, multi-step instructions
* **Higher Cost**: More expensive per request

## Best Practices

### For Comment Analysis

* Run toxicity and offensive detection in parallel
* Use sentiment analysis to understand emotional context
* Combine scores intelligently for severity assessment
* Provide specific reasons for classifications

### For Comment Rewriting

* Focus only on offensive portions, not entire comments
* Maintain the commenter's original tone and style
* Preserve the core message and argument
* Keep similar length to original input
* Test rewrites for both kindness and accuracy

### For Error Handling

* Implement graceful fallbacks for model failures
* Provide clear error messages to users
* Log failures for debugging and improvement
* Consider implementing retry logic for transient failures

## Performance Notes

* **Model Loading**: Models are loaded on-demand via HuggingFace's inference API
* **Response Time**: Typical analysis takes 2-5 seconds depending on text length
* **Rate Limits**: Respects HuggingFace's API rate limits
* **Caching**: Consider implementing Redis caching for frequently analyzed phrases

## Additional Server Features

The backend includes several quality‑of‑life improvements:

### Prompt caching

The rewrite instructions are read from `PROMPT.md` and cached for five minutes. Edits to the prompt file are picked up automatically once the cache expires—no restart needed.

### Rate limiting

All routes are protected by a rate limiter. Each client IP can make up to **100 requests every 15 minutes**; exceeding this limit yields a `429 Too Many Requests` error. This guards against abuse and helps manage your HuggingFace quota.

### Versioned API

All endpoints are prefixed with `/api/v1` to future‑proof the API. The root route `/` simply redirects to `/api/v1/health`.

### Health checks

The `GET /api/v1/health` endpoint performs a lightweight classification request to ensure your HuggingFace API key and the models are operational. It also reports the status of the prompt cache.

## Error Handling

* **API Failures**: Graceful fallback to basic analysis if models are unavailable
* **Invalid Input**: Proper validation and error messages for malformed requests
* **Model Errors**: Individual model failures don't crash the entire analysis

## Customization

You can modify the models by changing the `MODELS` object in `server.js`:

```javascript
const MODELS = {
  toxic: "your-preferred-toxicity-model",
  offensive: "your-preferred-offensive-model",
  sentiment: "your-preferred-sentiment-model",
  flanT5: "your-preferred-rewrite-model"
};
```

## Future Enhancements

### Model Improvements

* Fine-tune models on domain-specific data
* Implement ensemble methods for better accuracy
* Add multilingual support
* Consider smaller, faster models for edge deployment

### Prompt Engineering

* A/B test different prompt formulations
* Implement dynamic prompt selection based on context
* Add user preference learning
* Create prompt templates for different use cases

### Performance Optimization

* Implement caching for common phrases
* Add request queuing for high-load scenarios
* Consider model quantization for faster inference
* Implement batch processing for multiple comments

## Troubleshooting

* **API Key Issues**: Ensure your HuggingFace API key is valid and has proper permissions
* **Model Loading**: Check HuggingFace service status if models fail to load
* **Memory Issues**: Even with the smaller FLAN‑T5‑small model, rewrite generation can be memory‑intensive if run locally. Ensure adequate memory is available or consider further model quantization.
* **Rate Limiting**: If you hit API limits, implement request queuing or caching
