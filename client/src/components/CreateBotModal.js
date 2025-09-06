import React, { useState, useEffect } from 'react';
import { X, Bot, Code, FileCode, Sparkles } from 'lucide-react';
import { useBots } from '../contexts/BotContext';

const CreateBotModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    code: '',
    autoStart: false
  });
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const { createBot, getSupportedLanguages } = useBots();

  // Bot templates
  const botTemplates = {
    default: {
      name: 'Default Bot',
      description: 'Basic echo bot with command handling',
      code: `const TelegramBot = require('node-telegram-bot-api');

// Get bot token and mode from environment variables
const token = process.env.BOT_TOKEN;
const botMode = process.env.BOT_MODE || 'polling';

if (!token) {
  console.error('❌ BOT_TOKEN environment variable is required');
  process.exit(1);
}

// Bot configuration based on mode
let bot;
if (botMode === 'webhook') {
  // Webhook mode - requires HTTPS endpoint
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('❌ WEBHOOK_URL environment variable is required for webhook mode');
    process.exit(1);
  }
  
  bot = new TelegramBot(token, { 
    webHook: { 
      port: process.env.PORT || 8443,
      host: '0.0.0.0'
    }
  });
  
  // Set webhook URL
  bot.setWebHook(webhookUrl);
  console.log('🌐 Webhook mode enabled:', webhookUrl);
} else {
  // Polling mode (default)
  bot = new TelegramBot(token, { polling: true });
  console.log('📡 Polling mode enabled');
}

// Handle /start command
bot.onText(/\\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, \`Hello \${msg.from.first_name}! 👋\\nI'm your Telegram bot.\\n\\nCommands:\\n/help - Show this help\\n/status - Check bot status\\n/time - Current time\`);
});

// Handle /help command
bot.onText(/\\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, \`🤖 Bot Commands:\\n\\n/start - Start the bot\\n/help - Show this help\\n/status - Check bot status\\n/time - Current time\\n\\nBot is running smoothly! ✅\`);
});

// Handle /status command
bot.onText(/\\/status/, (msg) => {
  const chatId = msg.chat.id;
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  bot.sendMessage(chatId, \`🟢 Bot Status: ONLINE\\n📡 Mode: \${botMode.toUpperCase()}\\n⏱️ Uptime: \${hours}h \${minutes}m \${seconds}s\\n💾 Memory: \${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\`);
});

// Handle /time command
bot.onText(/\\/time/, (msg) => {
  const chatId = msg.chat.id;
  const now = new Date();
  bot.sendMessage(chatId, \`🕐 Current time: \${now.toLocaleString()}\`);
});

// Handle all other messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (text && !text.startsWith('/')) {
    // Echo non-command messages
    bot.sendMessage(chatId, \`You said: "\${text}"\\n\\nI'm an echo bot! 🗣️\`);
  }
});

// Handle errors
bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error);
});

console.log('🤖 Bot is running...');`
    },
    admin: {
      name: 'Admin Bot',
      description: 'Bot with admin commands and user management',
      code: `const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const adminId = process.env.ADMIN_ID; // Your Telegram user ID

if (!token) {
  console.error('❌ BOT_TOKEN environment variable is required');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Check if user is admin
function isAdmin(userId) {
  return adminId && userId.toString() === adminId.toString();
}

// Admin commands
bot.onText(/\\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, '❌ Access denied. Admin only.');
    return;
  }
  
  bot.sendMessage(msg.chat.id, \`🔐 Admin Panel\\n\\nCommands:\\n/users - List users\\n/broadcast - Send message to all users\\n/stats - Bot statistics\`);
});

bot.onText(/\\/users/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, '❌ Access denied. Admin only.');
    return;
  }
  
  // In a real bot, you'd store users in a database
  bot.sendMessage(msg.chat.id, '👥 User management feature - implement with database');
});

bot.onText(/\\/broadcast (.+)/, (msg, match) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, '❌ Access denied. Admin only.');
    return;
  }
  
  const message = match[1];
  // In a real bot, you'd send to all users from database
  bot.sendMessage(msg.chat.id, \`📢 Broadcast: \${message}\`);
});

bot.onText(/\\/stats/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, '❌ Access denied. Admin only.');
    return;
  }
  
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  bot.sendMessage(msg.chat.id, \`📊 Bot Statistics\\n\\n⏱️ Uptime: \${Math.floor(uptime / 3600)}h \${Math.floor((uptime % 3600) / 60)}m\\n💾 Memory: \${Math.round(memory.heapUsed / 1024 / 1024)}MB\\n🔄 Mode: Polling\`);
});

// Regular user commands
bot.onText(/\\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '👋 Welcome! This is an admin bot.');
});

console.log('🔐 Admin bot is running...');`
    },
    webhook: {
      name: 'Webhook Bot',
      description: 'Bot configured for webhook mode',
      code: `const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const token = process.env.BOT_TOKEN;
const webhookUrl = process.env.WEBHOOK_URL;
const port = process.env.PORT || 3000;

if (!token || !webhookUrl) {
  console.error('❌ BOT_TOKEN and WEBHOOK_URL environment variables are required');
  process.exit(1);
}

const app = express();
const bot = new TelegramBot(token);

// Middleware
app.use(express.json());

// Set webhook
bot.setWebHook(webhookUrl);
console.log('🌐 Webhook set to:', webhookUrl);

// Webhook endpoint
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Bot commands
bot.onText(/\\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🌐 Webhook bot is running!\\n\\nThis bot uses webhook mode for instant message delivery.');
});

bot.onText(/\\/ping/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🏓 Pong! Webhook is working perfectly.');
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (text && !text.startsWith('/')) {
    bot.sendMessage(chatId, \`📨 Webhook received: "\${text}"\`);
  }
});

// Start server
app.listen(port, () => {
  console.log(\`🚀 Webhook server running on port \${port}\`);
  console.log('🤖 Webhook bot is ready!');
});`
    }
  };

  useEffect(() => {}, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createBot(formData);
      handleClose();
    } catch (error) {
      console.error('Failed to create bot:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      token: '',
      code: '',
      autoStart: false
    });
    setSelectedTemplate('default');
    onClose();
  };

  const handleTemplateChange = (templateKey) => {
    setSelectedTemplate(templateKey);
    setFormData(prev => ({
      ...prev,
      code: botTemplates[templateKey].code
    }));
  };

  const getLanguageIcon = (language) => {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return <Code size={16} />;
      case 'python':
        return <Bot size={16} />;
      default:
        return <FileCode size={16} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Create New Bot
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Bot Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Bot Name
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input mt-1"
                  placeholder="My Awesome Bot"
                />
              </div>

              {/* Bot Token */}
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                  Bot Token
                </label>
                <input
                  type="password"
                  id="token"
                  required
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                  className="input mt-1"
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Get your bot token from @BotFather on Telegram
                </p>
              </div>

              {/* Bot Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bot Template
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(botTemplates).map(([key, template]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTemplateChange(key)}
                      className={`p-3 text-left border rounded-lg transition-colors ${
                        selectedTemplate === key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Sparkles size={16} className="text-blue-500" />
                        <div>
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-gray-600">{template.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial Code */}
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                  Initial Code (Optional)
                </label>
                <textarea
                  id="code"
                  rows={8}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="textarea mt-1 font-mono text-sm"
                  placeholder="// Your bot code here..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to use the default boilerplate code
                </p>
              </div>

              {/* Auto Start removed for simplicity */}
            </form>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading || !formData.name || !formData.token}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Bot'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary mt-3 sm:mt-0 sm:mr-3"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateBotModal;