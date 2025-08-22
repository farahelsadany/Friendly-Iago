# 🦜 Friendly Lago Setup Instructions

## Quick Start Guide

### 1. Set up the Backend Server

1. Navigate to the backend directory:
   ```bash
   cd friendly-lago-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `friendly-lago-backend` directory:
   ```bash
   cp env-template.txt .env
   ```

4. Add your HuggingFace API key to the `.env` file:
   ```
   HUGGINGFACE_API_KEY=your_huggingface_api_key_here
   PORT=8787
   ```

   **To get a HuggingFace API key:**
   - Go to [HuggingFace Settings](https://huggingface.co/settings/tokens)
   - Create a new access token
   - Copy the token and paste it in your .env file

5. Start the backend server:
   ```bash
   npm start
   ```

   You should see: `Friendly Lago AI backend listening on :8787`

### 2. Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`

2. Enable "Developer mode" (toggle in the top right)

3. Click "Load unpacked" and select the `friendly-lago-extension` folder

4. The Friendly Lago extension should now appear in your extensions bar! 🦜

### 3. Test the Extension

1. Click on the Friendly Lago icon in your browser toolbar
2. Type a test comment like: "This is stupid and you're an idiot"
3. Click "Check with Friendly Lago"
4. Watch the AI analyze and provide a kinder alternative! ✨

## What's New in This Version

### 🤖 **AI-Powered Analysis**
- **HuggingFace Models**: Uses state-of-the-art AI models for content analysis
- **Multi-Model Approach**: Combines toxicity, offensive language, and sentiment detection
- **FLAN-T5 Rewriting**: Google's FLAN-T5 model generates kinder alternatives
- **Intelligent Classification**: Sophisticated detection of harmful content

### 🎨 **Elegant & Simple UI**
- **Clean Design**: White background with professional styling
- **Logo Integration**: Uses your Friendly Lago logo
- **Word Limit**: 200-word limit with real-time counting
- **Streamlined Interface**: Focus on core functionality

### ✨ **Advanced Features**
- **Parallel Analysis**: All AI models run simultaneously for speed
- **Smart Rewriting**: Only changes offensive parts, preserves meaning
- **Length Preservation**: Maintains similar length to original
- **Copy Functionality**: Easy copying of suggestions
- **Try Again**: Reset and analyze new comments

### 🛠 **Technical Improvements**
- **HuggingFace Integration**: Professional AI model API
- **Dynamic Prompts**: Loads prompts from PROMPT.md file
- **Error Handling**: Graceful fallbacks if models are unavailable
- **Performance**: Fast analysis with multiple specialized models

## AI Models Used

1. **Toxic Comment Classification**: `unitary/unbiased-toxic-roberta`
   - Detects toxic content with high accuracy
   - Provides confidence scores for analysis

2. **Offensive Language Detection**: `cardiffnlp/twitter-roberta-base-offensive`
   - Identifies offensive language patterns
   - Optimized for social media content

3. **Sentiment Analysis**: `cardiffnlp/twitter-roberta-base-sentiment-latest`
   - Analyzes emotional tone (positive/negative/neutral)
   - Helps understand comment context

4. **Comment Rewriting**: `google/flan-t5-base`
   - Generates kinder, more inclusive alternatives
   - Maintains original meaning and length

## Troubleshooting

### Backend Issues
- **"Connection error"**: Make sure the backend server is running on port 8787
- **API Errors**: Check that your HuggingFace API key is valid
- **Model Loading**: Verify internet connection for HuggingFace API access

### Extension Issues
- **Extension not loading**: Make sure you're in Developer mode and the manifest.json is valid
- **Popup not working**: Check the browser console for JavaScript errors
- **Word limit exceeded**: Keep comments under 200 words

## Development Notes

### File Structure
```
friendly-lago-backend/
├── server.js          # AI-powered backend with HuggingFace models
├── package.json       # Dependencies (HuggingFace inference API)
├── PROMPT.md         # FLAN-T5 prompt template
├── .env              # API keys (create this)
├── env-template.txt  # Template for .env file
└── README.md         # Detailed technical documentation

friendly-lago-extension/
├── manifest.json     # Extension configuration
├── popup.html        # Clean, simple popup interface
├── popup.css         # Professional styling
├── popup.js          # Core functionality with word counting
├── content.js        # Injection script for social media sites
├── background.js     # Service worker for API communication
├── config.js         # Backend URL configuration
└── icons/
    ├── logo.png      # Friendly Lago logo
    ├── icon16.png    # Extension icons
    ├── icon48.png
    └── icon128.png
```

### Key Features

1. **AI-Powered Analysis**: Multiple HuggingFace models for comprehensive content analysis
2. **Smart Rewriting**: FLAN-T5 generates kinder alternatives while preserving meaning
3. **Dynamic Prompts**: Easy prompt modification through PROMPT.md file
4. **Professional UI**: Clean, elegant interface focused on functionality
5. **Robust Backend**: Error handling and fallbacks for reliable operation

### API Endpoints

- **POST /analyze**: Main analysis endpoint
- **GET /status**: Check model status and current prompt
- **GET /prompt**: View current prompt template
- **GET /**: Health check

Enjoy your new AI-powered Friendly Lago! 🦜✨
