## Overview
Friendly Lago helps your comments **land with kindness** without changing your stance. It uses **HuggingFace models** to detect toxicity, offensive language, and sentiment, then generates gentler alternatives with Google’s FLAN-T5.

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

4. **Comment Rewriting**: `google/flan-t5-base`
   - Generates kinder, more inclusive alternatives
   - Maintains original meaning while improving tone
   - Preserves similar length to original

## Core Principles

### 1. **Preserve the user's point and stance**
   - Do not change the position or meaning—only the delivery
   - Keep the core argument intact

### 2. **Avoid appearance talk**
   - Redirect to behavior/ideas instead of physical attributes
   - Focus on actions and consequences

### 3. **Reduce harm**
   - Remove insults, slurs, harassment
   - Eliminate identity-based attacks and threats
   - Avoid body-shaming language

### 4. **Respect free expression**
   - Keep critique intact but constructive
   - Maintain the user's right to express opinions

### 5. **Tone & length matching**
   - Match requested tone when specified
   - Prefer one-liners, then short (≤40 words), then medium (≤80 words)
   - Maintain similar length to original input

### 6. **Voice preservation**
   - Keep user's slang/stylistic quirks if requested
   - Maintain the commenter's unique tone

### 7. **Context-aware analysis**
   - Use post text, nearby comments, images (alt/URLs)
   - Consider author handle and site norms
   - Adapt to the specific platform context

### 8. **Clarification when helpful**
   - If a brief question could improve the rewrite, ask **one** short clarifying question
   - Keep questions focused and actionable

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Get HuggingFace API Key**:
   - Go to [HuggingFace Settings](https://huggingface.co/settings/tokens)
   - Create a new access token
   - Copy the token

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

### POST /analyze
Analyzes a comment and provides suggestions.

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
```

### GET /status
Check the status of all AI models and view the current prompt template.

### GET /prompt
View the current prompt template being used by the FLAN-T5 model.

### GET /
Health check endpoint.

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

The backend automatically loads the prompt template from `PROMPT.md` at startup. This allows you to:

- **Modify prompts without restarting**: Edit the PROMPT.md file and the changes will take effect on the next request
- **Version control prompts**: Track prompt changes in your git repository
- **A/B test prompts**: Easily switch between different prompt versions

### Prompt Parameters

The prompt template supports these variables:
- `${originalLength}`: Automatically replaced with the word count of the original comment
- `${text}`: Automatically replaced with the original comment text

### Modifying Prompts

To change the prompt:
1. Edit the `PROMPT.md` file
2. Update the prompt text within the code block (between ``` marks)
3. Save the file
4. The new prompt will be used for subsequent requests

### Prompt Endpoints

- **GET /prompt**: View the current prompt template and parameters
- **GET /status**: Check model status and see which prompt is currently loaded

## Implementation Notes

### HuggingFace Approach (Current)
- **Parallel Processing**: All classification models run simultaneously for efficiency
- **Score Aggregation**: Combines multiple model outputs for better accuracy
- **Fallback Handling**: Graceful degradation if AI models are unavailable
- **Length Preservation**: FLAN-T5 is specifically instructed to maintain similar length

### GPT Approach (Alternative)
- **Single Model**: Uses one large language model for all tasks
- **Contextual Understanding**: Better grasp of nuanced language and context
- **Flexible Prompts**: Can handle complex, multi-step instructions
- **Higher Cost**: More expensive per request

## Best Practices

### For Comment Analysis
- Run toxicity and offensive detection in parallel
- Use sentiment analysis to understand emotional context
- Combine scores intelligently for severity assessment
- Provide specific reasons for classifications

### For Comment Rewriting
- Focus only on offensive portions, not entire comments
- Maintain the commenter's original tone and style
- Preserve the core message and argument
- Keep similar length to original input
- Test rewrites for both kindness and accuracy

### For Error Handling
- Implement graceful fallbacks for model failures
- Provide clear error messages to users
- Log failures for debugging and improvement
- Consider implementing retry logic for transient failures

## Performance Notes

- **Model Loading**: Models are loaded on-demand via HuggingFace's inference API
- **Response Time**: Typical analysis takes 2-5 seconds depending on text length
- **Rate Limits**: Respects HuggingFace's API rate limits
- **Caching**: Consider implementing Redis caching for frequently analyzed phrases

## Error Handling

- **API Failures**: Graceful fallback to basic analysis if models are unavailable
- **Invalid Input**: Proper validation and error messages for malformed requests
- **Model Errors**: Individual model failures don't crash the entire analysis

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
- Fine-tune models on domain-specific data
- Implement ensemble methods for better accuracy
- Add multilingual support
- Consider smaller, faster models for edge deployment

### Prompt Engineering
- A/B test different prompt formulations
- Implement dynamic prompt selection based on context
- Add user preference learning
- Create prompt templates for different use cases

### Performance Optimization
- Implement caching for common phrases
- Add request queuing for high-load scenarios
- Consider model quantization for faster inference
- Implement batch processing for multiple comments

## Troubleshooting

- **API Key Issues**: Ensure your HuggingFace API key is valid and has proper permissions
- **Model Loading**: Check HuggingFace service status if models fail to load
- **Memory Issues**: The FLAN-T5 model can be memory-intensive; consider using a smaller variant
- **Rate Limiting**: If you hit API limits, implement request queuing or caching
