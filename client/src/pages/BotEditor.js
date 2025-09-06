import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Editor } from '@monaco-editor/react';
import { 
  Save, 
  Play, 
  Square, 
  RotateCcw, 
  FileText, 
  AlertTriangle,
  Settings,
  Activity,
  Clock,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Upload,
  Download,
  Code,
  Sparkles,
  Github,
  Copy,
  Zap,
  X
} from 'lucide-react';
import { useBots } from '../contexts/BotContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-hot-toast';

const BotEditor = () => {
  const { botId } = useParams();
  const { bots, getBot, getBotFile, updateBotFile, startBot, stopBot, updateBot } = useBots();
  const { joinBotRoom, leaveBotRoom } = useSocket();
  
  const [code, setCode] = useState('');
  const [originalCode, setOriginalCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bot, setBot] = useState(null);
  const [activeTab, setActiveTab] = useState('editor');
  const [logs, setLogs] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorInstance, setEditorInstance] = useState(null);
  const [environmentVariables, setEnvironmentVariables] = useState([
    { key: 'BOT_TOKEN', value: '', isSecret: true },
    { key: 'BOT_MODE', value: 'polling', isSecret: false },
    { key: 'PROTECT_CONTENT', value: 'false', isSecret: false }
  ]);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showGitHubImport, setShowGitHubImport] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const autoSaveTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState('bot.js');
  const [fileContents, setFileContents] = useState({});
  const [showFileTree, setShowFileTree] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [showSecretManager, setShowSecretManager] = useState(false);
  const [showImportSources, setShowImportSources] = useState(false);

  // Detect Android to enable native long-press selection by using a textarea fallback
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

  // Common environment variable suggestions
  const commonEnvVars = [
    'BOT_TOKEN',
    'NODE_ENV',
    'BOT_MODE',
    'PROTECT_CONTENT',
    'WEBHOOK_URL',
    'PORT',
    'DATABASE_URL',
    'REDIS_URL',
    'API_KEY',
    'SECRET_KEY',
    'ACCESS_TOKEN',
    'REFRESH_TOKEN',
    'CLIENT_ID',
    'CLIENT_SECRET',
    'WEBHOOK_SECRET',
    'LOG_LEVEL',
    'DEBUG',
    'ENVIRONMENT',
    'REGION',
    'TIMEZONE',
    'LANGUAGE'
  ];

  // Code snippets
  const codeSnippets = [
    {
      name: 'Send Message',
      code: `bot.sendMessage(chatId, 'Hello! 👋', {
  reply_markup: {
    inline_keyboard: [[
      { text: 'Button 1', callback_data: 'btn1' },
      { text: 'Button 2', callback_data: 'btn2' }
    ]]
  }
});`
    },
    {
      name: 'Handle Commands',
      code: `bot.onText(/\\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! 🎉');
});`
    },
    {
      name: 'Handle Callbacks',
      code: `bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  
  if (data === 'btn1') {
    bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Button 1 clicked!'
    });
  }
});`
    },
    {
      name: 'Environment Variable',
      code: `const apiKey = process.env.API_KEY;
const isProduction = process.env.NODE_ENV === 'production';

if (!apiKey) {
  console.error('API_KEY is required');
  process.exit(1);
}`
    },
    {
      name: 'Error Handling',
      code: `try {
  // Your bot logic here
  await bot.sendMessage(chatId, 'Success!');
} catch (error) {
  console.error('Error:', error);
  bot.sendMessage(chatId, 'Sorry, something went wrong!');
}`
    },
    {
      name: 'File Upload',
      code: `bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1];
  
  bot.sendMessage(chatId, \`Photo received! File ID: \${photo.file_id}\`);
});`
    }
  ];
  const [showSecrets, setShowSecrets] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (botId) {
      try {
        joinBotRoom(botId);
        loadBotData();
      } catch (error) {
        console.error('Error in useEffect:', error);
        setHasError(true);
        setLoading(false);
      }
    }

    return () => {
      if (botId) {
        try {
          leaveBotRoom(botId);
        } catch (error) {
          console.error('Error leaving bot room:', error);
        }
      }
    };
  }, [botId, bots]);

  // Listen for bot status updates
  useEffect(() => {
    if (!botId) return;

    const handleBotStatus = (data) => {
      if (data.botId === botId) {
        console.log('Bot status update:', data);
        // Update the bot status in the local state
        setBot(prevBot => prevBot ? { ...prevBot, status: data.status } : prevBot);
      }
    };

    const handleBotLog = (data) => {
      if (data.botId === botId) {
        setLogs(prevLogs => [...prevLogs, data.log]);
      }
    };

    const handleBotError = (data) => {
      if (data.botId === botId) {
        setErrors(prevErrors => [...prevErrors, data.error]);
      }
    };

    // Add event listeners
    const socket = window.socket || null;
    if (socket) {
      socket.on('bot-status', handleBotStatus);
      socket.on('bot-log', handleBotLog);
      socket.on('bot-error', handleBotError);

      return () => {
        socket.off('bot-status', handleBotStatus);
        socket.off('bot-log', handleBotLog);
        socket.off('bot-error', handleBotError);
      };
    }
  }, [botId]);

  // Keyboard shortcut for fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F11' && activeTab === 'editor') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);



  // Auto-detect environment variables when code changes (debounced)
  useEffect(() => {
    if (!autoDetectEnabled || !code || code === originalCode) return;

    const timer = setTimeout(() => {
      // Only auto-detect if we have significant code changes
      if (code.length > 50) {
        const patterns = [
          /process\.env\.([A-Z_][A-Z0-9_]*)/g,
          /process\.env\[['"`]([A-Z_][A-Z0-9_]*)['"`]\]/g,
          /process\.env\[`([A-Z_][A-Z0-9_]*)`\]/g,
          /process\.env\[([A-Z_][A-Z0-9_]*)\]/g,
        ];

        const detectedVars = new Set();
        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(code)) !== null) {
            const varName = match[1];
            if (varName && varName.length > 0) {
              detectedVars.add(varName);
            }
          }
        });

        const commonBuiltins = ['NODE_ENV', 'PATH', 'HOME', 'USER', 'PWD', 'SHELL', 'LANG', 'TZ'];
        const newVars = Array.from(detectedVars)
          .filter(varName => !commonBuiltins.includes(varName) && varName.length > 1)
          .filter(varName => !environmentVariables.some(existing => existing.key === varName));

        if (newVars.length > 0) {
          const envVarsToAdd = newVars.map(varName => {
            const secretKeywords = ['token', 'secret', 'key', 'password', 'pass', 'auth', 'private'];
            const isSecret = secretKeywords.some(keyword => varName.toLowerCase().includes(keyword));
            
            let defaultValue = '';
            if (varName === 'BOT_TOKEN' || varName === 'TOKEN') {
              defaultValue = bot?.token || '';
            } else if (varName === 'NODE_ENV') {
              defaultValue = 'production';
            } else if (varName === 'PORT') {
              defaultValue = '3000';
            } else if (varName === 'BOT_MODE') {
              defaultValue = 'polling';
            }

            return { key: varName, value: defaultValue, isSecret };
          });

          setEnvironmentVariables(prev => [...prev, ...envVarsToAdd]);
          toast.success(`Auto-detected ${envVarsToAdd.length} new environment variables`);
        }
      }
    }, 2000); // Wait 2 seconds after code changes

    return () => clearTimeout(timer);
  }, [code, autoDetectEnabled, environmentVariables, originalCode, bot?.token]);

  const loadBotData = async () => {
    setLoading(true);
    try {
      let currentBot = bots.find(b => b.id === botId);
      
      if (!currentBot) {
        currentBot = await getBot(botId);
      }
      
      if (currentBot) {
        setBot(currentBot);
        
        // Load bot code
        const fileData = await getBotFile(botId);
        const botCode = fileData.content || '';
        setCode(botCode);
        setOriginalCode(botCode);
        

        
        // Load environment variables if they exist
        if (currentBot.environmentVariables && Array.isArray(currentBot.environmentVariables)) {
          // Hide PROTECT_CONTENT unless it is referenced in code
          const referencesProtect = /process\.env\.PROTECT_CONTENT|process\.env\[['"`]PROTECT_CONTENT['"`]\]/.test(botCode);
          const filtered = referencesProtect
            ? currentBot.environmentVariables
            : currentBot.environmentVariables.filter(v => v.key !== 'PROTECT_CONTENT');
          setEnvironmentVariables(filtered);
        } else {
          // Set default environment variables
          setEnvironmentVariables([
            { key: 'BOT_TOKEN', value: currentBot.token || '', isSecret: true },
            { key: 'NODE_ENV', value: 'production', isSecret: false },
            { key: 'BOT_MODE', value: 'polling', isSecret: false }
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to load bot data:', error);
      toast.error('Failed to load bot data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (code === originalCode) return;
    
    setSaving(true);
    try {
      await updateBotFile(botId, code);
      setOriginalCode(code);
      toast.success('Code saved successfully!');
    } catch (error) {
      console.error('Failed to save code:', error);
      toast.error('Failed to save code');
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async () => {
    try {
      // Update bot with environment variables before starting
      await updateBot(botId, { environmentVariables });
      
      setBot(prevBot => ({ ...prevBot, status: 'starting' }));
      await startBot(botId);
      toast.success('Bot started successfully!');
    } catch (error) {
      console.error('Failed to start bot:', error);
      toast.error('Failed to start bot');
      setBot(prevBot => ({ ...prevBot, status: 'stopped' }));
    }
  };

  const handleStop = async () => {
    if (window.confirm('Are you sure you want to stop this bot?')) {
      try {
        setBot(prevBot => ({ ...prevBot, status: 'stopping' }));
        await stopBot(botId);
        toast.success('Bot stopped successfully!');
      } catch (error) {
        console.error('Failed to stop bot:', error);
        toast.error('Failed to stop bot');
        setBot(prevBot => ({ ...prevBot, status: 'running' }));
      }
    }
  };

  const handleRestart = async () => {
    try {
      await handleStop();
      setTimeout(async () => {
        await handleStart();
      }, 1000);
    } catch (error) {
      console.error('Failed to restart bot:', error);
      toast.error('Failed to restart bot');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const getLanguage = () => {
    return 'javascript';
  };

  const getStatusBadge = () => {
    if (!bot) return null;
    
    const statusColors = {
      running: 'bg-green-100 text-green-800',
      stopped: 'bg-gray-100 text-gray-800',
      starting: 'bg-yellow-100 text-yellow-800',
      stopping: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[bot.status] || statusColors.stopped}`}>
        <Activity size={12} className="mr-1" />
        {bot.status || 'stopped'}
      </span>
    );
  };

  // Environment Variables Functions
  const addEnvironmentVariable = () => {
    try {
      setEnvironmentVariables([...environmentVariables, { key: '', value: '', isSecret: false }]);
    } catch (error) {
      console.error('Error adding environment variable:', error);
      toast.error('Failed to add environment variable');
    }
  };

  const removeEnvironmentVariable = (index) => {
    try {
      setEnvironmentVariables(environmentVariables.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error removing environment variable:', error);
      toast.error('Failed to remove environment variable');
    }
  };

  const updateEnvironmentVariable = (index, field, value) => {
    try {
      const updated = [...environmentVariables];
      updated[index] = { ...updated[index], [field]: value };
      setEnvironmentVariables(updated);
    } catch (error) {
      console.error('Error updating environment variable:', error);
      toast.error('Failed to update environment variable');
    }
  };

  const saveEnvironmentVariables = async () => {
    try {
      await updateBot(botId, { environmentVariables });
      toast.success('Environment variables saved!');
    } catch (error) {
      console.error('Failed to save environment variables:', error);
      toast.error('Failed to save environment variables');
    }
  };

  const autoFillEnvironmentVariables = () => {
    const defaultVars = [
      { key: 'BOT_TOKEN', value: bot?.token || '', isSecret: true },
      { key: 'NODE_ENV', value: 'production', isSecret: false },
      { key: 'BOT_MODE', value: 'polling', isSecret: false },
      { key: 'PORT', value: '3000', isSecret: false },
      { key: 'LOG_LEVEL', value: 'info', isSecret: false },
      { key: 'DEBUG', value: 'false', isSecret: false },
      { key: 'WEBHOOK_URL', value: '', isSecret: false },
      { key: 'WEBHOOK_SECRET', value: '', isSecret: true }
    ];
    
    // Merge with existing variables, avoiding duplicates
    const existingKeys = environmentVariables.map(v => v.key);
    const newVars = defaultVars.filter(v => !existingKeys.includes(v.key));
    
    setEnvironmentVariables([...environmentVariables, ...newVars]);
    toast.success('Default environment variables added!');
  };

  const detectEnvironmentVariablesFromCode = () => {
    if (!code) {
      toast.error('No code to analyze');
      return;
    }

    // Common patterns for environment variables in JavaScript/Node.js
    const patterns = [
      /process\.env\.([A-Z_][A-Z0-9_]*)/g,           // process.env.VARIABLE_NAME
      /process\.env\[['"`]([A-Z_][A-Z0-9_]*)['"`]\]/g, // process.env['VARIABLE_NAME']
      /process\.env\[`([A-Z_][A-Z0-9_]*)`\]/g,        // process.env[`VARIABLE_NAME`]
      /process\.env\[([A-Z_][A-Z0-9_]*)\]/g,          // process.env[VARIABLE_NAME]
      /process\.env\.([a-z][a-z0-9_]*)/g,              // process.env.variable_name (lowercase)
      /process\.env\[['"`]([a-z][a-z0-9_]*)['"`]\]/g, // process.env['variable_name']
      /process\.env\[`([a-z][a-z0-9_]*)`\]/g,         // process.env[`variable_name`]
      /process\.env\[([a-z][a-z0-9_]*)\]/g,            // process.env[variable_name]
      /process\.env\.([A-Za-z][A-Za-z0-9_]*)/g,       // process.env.MixedCase
      /process\.env\[['"`]([A-Za-z][A-Za-z0-9_]*)['"`]\]/g, // process.env['MixedCase']
      /process\.env\[`([A-Za-z][A-Za-z0-9_]*)`\]/g,   // process.env[`MixedCase`]
      /process\.env\[([A-Za-z][A-Za-z0-9_]*)\]/g,     // process.env[MixedCase]
    ];

    const detectedVars = new Set();
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const varName = match[1];
        if (varName && varName.length > 0) {
          detectedVars.add(varName);
        }
      }
    });

    // Convert to array and filter out common Node.js built-ins
    const commonBuiltins = ['NODE_ENV', 'PATH', 'HOME', 'USER', 'PWD', 'SHELL', 'LANG', 'TZ'];
    const filteredVars = Array.from(detectedVars)
      .filter(varName => !commonBuiltins.includes(varName) && varName.length > 1);

    if (filteredVars.length === 0) {
      toast.error('No environment variables detected in code');
      return;
    }

    // Create environment variable objects
    const newVars = filteredVars.map(varName => {
      // Determine if it's likely a secret based on the name
      const secretKeywords = ['token', 'secret', 'key', 'password', 'pass', 'auth', 'private'];
      const isSecret = secretKeywords.some(keyword => 
        varName.toLowerCase().includes(keyword)
      );
      
      // Set default values for common variables
      let defaultValue = '';
      if (varName === 'BOT_TOKEN' || varName === 'TOKEN') {
        defaultValue = bot?.token || '';
      } else if (varName === 'NODE_ENV') {
        defaultValue = 'production';
      } else if (varName === 'PORT') {
        defaultValue = '3000';
      } else if (varName === 'BOT_MODE') {
        defaultValue = 'polling';
      }

      return {
        key: varName,
        value: defaultValue,
        isSecret: isSecret
      };
    });

    // Merge with existing variables, avoiding duplicates
    const existingKeys = environmentVariables.map(v => v.key);
    const uniqueNewVars = newVars
      .filter(v => !existingKeys.includes(v.key));
    
    if (uniqueNewVars.length === 0) {
      toast.info('All detected environment variables already exist');
      return;
    }

    setEnvironmentVariables([...environmentVariables, ...uniqueNewVars]);
    toast.success(`Detected and added ${uniqueNewVars.length} environment variables from code!`);
  };

  // Error Functions
  const clearErrors = () => {
    setErrors([]);
    toast.success('Errors cleared');
  };

  const copyError = (error) => {
    navigator.clipboard.writeText(error);
    toast.success('Error copied to clipboard');
  };

  const formatError = (error) => {
    // Try to parse and format error messages
    if (typeof error === 'string') {
      return error;
    }
    return JSON.stringify(error, null, 2);
  };

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (code !== originalCode && !saving) {
      try {
        await updateBotFile(botId, code);
        setOriginalCode(code);
        toast.success('Auto-saved!', { duration: 1000 });
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }
  }, [code, originalCode, saving, botId, updateBotFile]);

  // Debounced auto-save
  useEffect(() => {
    if (autoSaveEnabled && code !== originalCode) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(autoSave, 2000);
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [code, autoSaveEnabled, autoSave, originalCode]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const textFile = files.find(file => file.type === 'text/plain' || file.name.endsWith('.js'));
    
    if (textFile) {
      try {
        const content = await textFile.text();
        setCode(content);
        toast.success('File imported successfully!');
      } catch (error) {
        toast.error('Failed to read file');
      }
    } else {
      toast.error('Please drop a .js or .txt file');
    }
  }, []);

  // File input handler
  const handleFileInput = useCallback(async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const content = await file.text();
        setCode(content);
        toast.success('File imported successfully!');
      } catch (error) {
        toast.error('Failed to read file');
      }
    }
  }, []);

  // GitHub import
  const handleGitHubImport = useCallback(async () => {
    if (!githubUrl) {
      toast.error('Please enter a GitHub URL');
      return;
    }

    try {
      let rawUrl = githubUrl;
      if (githubUrl.includes('github.com') && !githubUrl.includes('raw.githubusercontent.com')) {
        rawUrl = githubUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }

      const response = await fetch(rawUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }
      
      const content = await response.text();
      setCode(content);
      setShowGitHubImport(false);
      setGithubUrl('');
      toast.success('Code imported from GitHub!');
    } catch (error) {
      toast.error('Failed to import from GitHub');
    }
  }, [githubUrl]);

  // Insert snippet
  const insertSnippet = useCallback((snippet) => {
    if (editorInstance) {
      const selection = editorInstance.getSelection();
      const range = new editorInstance.Range(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn
      );
      editorInstance.executeEdits('insert-snippet', [{
        range: range,
        text: snippet.code
      }]);
      setShowSnippets(false);
      toast.success('Snippet inserted!');
    }
  }, [editorInstance]);

  // Format code with Prettier (basic formatting)
  const formatCode = useCallback(() => {
    if (editorInstance) {
      // Basic formatting - indent and clean up
      const model = editorInstance.getModel();
      const value = model.getValue();
      
      // Simple formatting: fix indentation and spacing
      const formatted = value
        .split('\n')
        .map(line => {
          // Basic indentation fix
          const trimmed = line.trim();
          if (trimmed === '') return '';
          
          // Count braces for indentation
          const openBraces = (line.match(/\{/g) || []).length;
          const closeBraces = (line.match(/\}/g) || []).length;
          
          return '  '.repeat(Math.max(0, openBraces - closeBraces)) + trimmed;
        })
        .join('\n');
      
      model.setValue(formatted);
      toast.success('Code formatted!');
    }
  }, [editorInstance]);

  // Export bot configuration
  const exportBot = useCallback(() => {
    const botData = {
      name: bot.name,
      code: code,
      environmentVariables: environmentVariables,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(botData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bot.name}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bot exported successfully!');
  }, [bot, code, environmentVariables]);

  // Import bot configuration
  const importBot = useCallback(async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const content = await file.text();
        const botData = JSON.parse(content);
        
        if (botData.code) setCode(botData.code);
        if (botData.environmentVariables) setEnvironmentVariables(botData.environmentVariables);
        
        toast.success('Bot imported successfully!');
      } catch (error) {
        toast.error('Failed to import bot configuration');
      }
    }
  }, []);

  // Touch gesture handlers
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const handleTouchStart = useCallback((e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      // Swipe left - next tab
      const tabs = ['editor', 'environment', 'errors', 'settings'];
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
      }
    }
    if (isRightSwipe) {
      // Swipe right - previous tab
      const tabs = ['editor', 'environment', 'errors', 'settings'];
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      }
    }
  }, [touchStart, touchEnd, activeTab]);

  // File management functions
  const loadFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/files/${botId}/structure`);
      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  }, [botId]);

  const loadFileContent = useCallback(async (filePath) => {
    try {
      const response = await fetch(`/api/files/${botId}/file?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();
      if (data.success) {
        setFileContents(prev => ({ ...prev, [filePath]: data.content }));
      }
    } catch (error) {
      console.error('Failed to load file content:', error);
    }
  }, [botId]);

  const saveFileContent = useCallback(async (filePath, content) => {
    try {
      const response = await fetch(`/api/files/${botId}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content })
      });
      const data = await response.json();
      if (data.success) {
        setFileContents(prev => ({ ...prev, [filePath]: content }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save file:', error);
      return false;
    }
  }, [botId]);

  const createFile = useCallback(async (filePath, content = '') => {
    try {
      const response = await fetch(`/api/files/${botId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content })
      });
      const data = await response.json();
      if (data.success) {
        await loadFiles();
        setFileContents(prev => ({ ...prev, [filePath]: content }));
        setActiveFile(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to create file:', error);
      return false;
    }
  }, [botId, loadFiles]);

  const deleteFile = useCallback(async (filePath) => {
    try {
      const response = await fetch(`/api/files/${botId}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      const data = await response.json();
      if (data.success) {
        await loadFiles();
        setFileContents(prev => {
          const newContents = { ...prev };
          delete newContents[filePath];
          return newContents;
        });
        if (activeFile === filePath) {
          setActiveFile('bot.js');
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }, [botId, loadFiles, activeFile]);

  // Diagnostics functions
  const runDiagnostics = useCallback(() => {
    const issues = [];
    const currentCode = fileContents[activeFile] || code;
    
    // Check for syntax errors
    try {
      new Function(currentCode);
    } catch (error) {
      issues.push({
        type: 'error',
        message: `Syntax Error: ${error.message}`,
        line: error.lineNumber || 1
      });
    }
    
    // Check for missing environment variables
    const envVarMatches = currentCode.match(/process\.env\.(\w+)/g) || [];
    const usedEnvVars = [...new Set(envVarMatches.map(match => match.replace('process.env.', '')))];
    const definedEnvVars = environmentVariables.map(env => env.key);
    const missingEnvVars = usedEnvVars.filter(envVar => !definedEnvVars.includes(envVar));
    
    missingEnvVars.forEach(envVar => {
      issues.push({
        type: 'warning',
        message: `Missing environment variable: ${envVar}`,
        line: 1
      });
    });
    
    // Check for common issues
    if (currentCode.includes('console.log') && !currentCode.includes('logger')) {
      issues.push({
        type: 'info',
        message: 'Consider using logger instead of console.log for better log management',
        line: 1
      });
    }
    
    setDiagnostics(issues);
  }, [fileContents, activeFile, code, environmentVariables]);

  // Version management functions
  const loadVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/versions/${botId}/snapshots`);
      const data = await response.json();
      if (data.success) {
        setVersions(data.snapshots);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    }
  }, [botId]);

  const createSnapshot = useCallback(async (label) => {
    try {
      const response = await fetch(`/api/versions/${botId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          code: fileContents[activeFile] || code,
          files: files.map(f => ({ path: f.name, content: fileContents[f.name] || '' })),
          environmentVariables
        })
      });
      const data = await response.json();
      if (data.success) {
        await loadVersions();
        toast.success('Snapshot created!');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      return false;
    }
  }, [botId, fileContents, activeFile, code, files, environmentVariables, loadVersions]);

  // Load files on mount
  useEffect(() => {
    if (botId) {
      loadFiles();
    }
  }, [botId, loadFiles]);

  // Load file content when active file changes
  useEffect(() => {
    if (activeFile && !fileContents[activeFile]) {
      loadFileContent(activeFile);
    }
  }, [activeFile, fileContents, loadFileContent]);

  // Run diagnostics when code changes
  useEffect(() => {
    if (showDiagnostics) {
      runDiagnostics();
    }
  }, [showDiagnostics, runDiagnostics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-4">There was an error loading the bot editor.</p>
        <Link to="/" className="btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Bot Not Found</h2>
        <p className="text-gray-600 mb-4">The bot you're looking for doesn't exist.</p>
        <Link to="/" className="btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <Link to="/" className="text-primary-600 hover:text-primary-700">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{bot.name}</h1>
            {getStatusBadge()}
          </div>
          <p className="text-gray-600 mt-1">
            {bot.language} • Created {new Date(bot.createdAt).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSave}
            disabled={saving || code === originalCode}
            className="btn-primary"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
          
          {bot.status === 'running' ? (
            <button onClick={handleStop} className="btn-secondary">
              <Square size={16} />
              Stop
            </button>
          ) : (
            <button onClick={handleStart} className="btn-success">
              <Play size={16} />
              Start
            </button>
          )}
          
          <button onClick={handleRestart} className="btn-secondary">
            <RotateCcw size={16} />
            Restart
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('editor')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'editor'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText size={16} className="inline mr-2" />
            Code Editor
          </button>
          <button
            onClick={() => setActiveTab('environment')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'environment'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings size={16} className="inline mr-2" />
            Environment Variables
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'errors'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <AlertTriangle size={16} className="inline mr-2" />
            Errors ({errors.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings size={16} className="inline mr-2" />
            Settings
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'editor' && (
        <div 
          className={`card ${isFullscreen ? 'fixed inset-0 z-50 m-0 rounded-none' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={`${isFullscreen ? 'h-full' : 'h-96'} overflow-hidden relative`}>
            {/* Drag overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-500 z-20 flex items-center justify-center">
                <div className="text-center text-blue-600">
                  <Upload size={48} className="mx-auto mb-2" />
                  <p className="text-lg font-semibold">Drop your .js or .txt file here</p>
                </div>
              </div>
            )}

            {/* Editor toolbar */}
            <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs"
                title="Import File"
              >
                <Upload size={14} />
              </button>
              <button
                onClick={exportBot}
                className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs"
                title="Export Bot"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => document.getElementById('import-bot')?.click()}
                className="p-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-xs"
                title="Import Bot"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => setShowSnippets(!showSnippets)}
                className="p-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-xs"
                title="Code Snippets"
              >
                <Code size={14} />
              </button>
              <button
                onClick={formatCode}
                className="p-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors text-xs"
                title="Format Code"
              >
                <Sparkles size={14} />
              </button>
              <button
                onClick={() => setShowGitHubImport(!showGitHubImport)}
                className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-xs"
                title="Import from GitHub"
              >
                <Github size={14} />
              </button>
              <button
                onClick={() => setShowFileTree(!showFileTree)}
                className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-xs"
                title="File Tree"
              >
                <FileText size={14} />
              </button>
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="p-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-xs"
                title="Diagnostics"
              >
                <AlertTriangle size={14} />
              </button>
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="p-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors text-xs"
                title="Version History"
              >
                <Clock size={14} />
              </button>
              <button
                onClick={() => setShowSecretManager(!showSecretManager)}
                className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs"
                title="Secret Manager"
              >
                <Eye size={14} />
              </button>
              <button
                onClick={() => setShowImportSources(!showImportSources)}
                className="p-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-xs"
                title="Import Sources"
              >
                <Upload size={14} />
              </button>
              <div className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  id="autoSave"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="autoSave" className="text-xs text-white">
                  Auto-save
                </label>
              </div>
            </div>

            {/* Fullscreen toggle button */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-2 right-2 z-10 p-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>


            {isAndroid ? (
              <textarea
                className="w-full h-full p-4 bg-gray-900 text-white font-mono text-sm outline-none resize-none"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
            ) : (
              <Editor
                height="100%"
                language={getLanguage()}
                value={code}
                onChange={setCode}
                theme="vs-dark"
                onMount={(editor, monaco) => {
                  setEditorInstance(editor);
                  // Focus editor when loaded
                  setTimeout(() => {
                    editor.focus();
                  }, 100);
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: true,
                  automaticLayout: true,
                  wordWrap: 'off',
                  folding: true,
                  lineDecorationsWidth: 10,
                  lineNumbersMinChars: 3,
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    verticalScrollbarSize: 12,
                    horizontalScrollbarSize: 12,
                    useShadows: true,
                  },
                  overviewRulerBorder: true,
                  overviewRulerLanes: 3,
                  fixedOverflowWidgets: true,
                  renderWhitespace: 'selection',
                  renderControlCharacters: false,
                  renderLineHighlight: 'all',
                  selectOnLineNumbers: false,
                  glyphMargin: true,
                  useTabStops: false,
                  insertSpaces: true,
                  tabSize: 2,
                  detectIndentation: true,
                  trimAutoWhitespace: true,
                  largeFileOptimizations: true,
                  parameterHints: {
                    enabled: true,
                    cycle: true,
                  },
                  autoIndent: 'full',
                  formatOnPaste: true,
                  formatOnType: true,
                  // Enable keyboard shortcuts
                  multiCursorModifier: 'alt',
                  accessibilitySupport: 'on',
                  copyWithSyntaxHighlighting: true,
                  // Mobile-friendly text selection
                  selectionClipboard: false,
                  contextmenu: true,
                  // Mobile text selection improvements
                  mouseWheelZoom: false,
                  disableLayerHinting: true,
                  // Disable features that interfere with text selection
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  acceptSuggestionOnCommitCharacter: false,
                  acceptSuggestionOnEnter: 'off'
                }}
              />
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.txt"
              onChange={handleFileInput}
              className="hidden"
            />
            <input
              id="import-bot"
              type="file"
              accept=".json"
              onChange={importBot}
              className="hidden"
            />
          </div>

          {/* Code Snippets Modal */}
          {showSnippets && (
            <div className="absolute inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Code Snippets</h3>
                  <button
                    onClick={() => setShowSnippets(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {codeSnippets.map((snippet, index) => (
                    <button
                      key={index}
                      onClick={() => insertSnippet(snippet)}
                      className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-sm mb-1">{snippet.name}</div>
                      <div className="text-xs text-gray-600 font-mono bg-gray-100 p-2 rounded">
                        {snippet.code.split('\n')[0]}...
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* GitHub Import Modal */}
          {showGitHubImport && (
            <div className="absolute inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Import from GitHub</h3>
                  <button
                    onClick={() => setShowGitHubImport(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GitHub URL
                    </label>
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/user/repo/blob/main/bot.js"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleGitHubImport}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Import
                    </button>
                    <button
                      onClick={() => setShowGitHubImport(false)}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* File Tree Modal */}
          {showFileTree && (
            <div className="absolute inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">File Tree</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const fileName = prompt('Enter file name:');
                        if (fileName) createFile(fileName);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      New File
                    </button>
                    <button
                      onClick={() => setShowFileTree(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <button
                        onClick={() => {
                          setActiveFile(file.name);
                          setShowFileTree(false);
                        }}
                        className="flex items-center space-x-2 text-left flex-1"
                      >
                        <FileText size={16} />
                        <span className={activeFile === file.name ? 'font-semibold text-blue-600' : ''}>
                          {file.name}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteFile(file.name)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Diagnostics Modal */}
          {showDiagnostics && (
            <div className="absolute inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Live Diagnostics</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={runDiagnostics}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={() => setShowDiagnostics(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {diagnostics.length === 0 ? (
                    <p className="text-gray-500">No issues found!</p>
                  ) : (
                    diagnostics.map((issue, index) => (
                      <div key={index} className={`p-3 rounded border-l-4 ${
                        issue.type === 'error' ? 'bg-red-50 border-red-500' :
                        issue.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                        'bg-blue-50 border-blue-500'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <AlertTriangle size={16} className={
                            issue.type === 'error' ? 'text-red-500' :
                            issue.type === 'warning' ? 'text-yellow-500' :
                            'text-blue-500'
                          } />
                          <span className="font-medium">{issue.message}</span>
                        </div>
                        {issue.line && (
                          <p className="text-sm text-gray-600 mt-1">Line {issue.line}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Version Timeline Modal */}
          {showVersions && (
            <div className="absolute inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Version History</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const label = prompt('Enter snapshot label:');
                        if (label) createSnapshot(label);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Create Snapshot
                    </button>
                    <button
                      onClick={() => setShowVersions(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {versions.length === 0 ? (
                    <p className="text-gray-500">No snapshots yet. Create one to track changes!</p>
                  ) : (
                    versions.map((version, index) => (
                      <div key={version.id} className="p-3 border rounded hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{version.label || `Snapshot ${index + 1}`}</h4>
                            <p className="text-sm text-gray-600">
                              {new Date(version.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                // TODO: Implement diff view
                                toast.info('Diff view coming soon!');
                              }}
                              className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                            >
                              View Diff
                            </button>
                            <button
                              onClick={() => {
                                // TODO: Implement restore
                                toast.info('Restore coming soon!');
                              }}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Secret Manager Modal */}
          {showSecretManager && (
            <div className="absolute inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Secret Manager</h3>
                  <button
                    onClick={() => setShowSecretManager(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-3">
                  {environmentVariables.map((envVar, index) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{envVar.key}</span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(envVar.value);
                              toast.success('Copied to clipboard!');
                            }}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              const newValue = prompt(`Enter new value for ${envVar.key}:`);
                              if (newValue !== null) {
                                const newEnvVars = [...environmentVariables];
                                newEnvVars[index].value = newValue;
                                setEnvironmentVariables(newEnvVars);
                                toast.success('Value updated!');
                              }
                            }}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Update
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type={envVar.isSecret ? 'password' : 'text'}
                          value={envVar.value}
                          readOnly
                          className="flex-1 px-2 py-1 border rounded text-sm font-mono"
                        />
                        <button
                          onClick={() => {
                            const newEnvVars = [...environmentVariables];
                            newEnvVars[index].isSecret = !envVar.isSecret;
                            setEnvironmentVariables(newEnvVars);
                          }}
                          className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                        >
                          {envVar.isSecret ? 'Show' : 'Hide'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Import Sources Modal */}
          {showImportSources && (
            <div className="absolute inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Import Sources</h3>
                  <button
                    onClick={() => setShowImportSources(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GitHub Gist URL
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        placeholder="https://gist.github.com/username/gistid"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => toast.info('Gist import coming soon!')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Import
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pastebin URL
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        placeholder="https://pastebin.com/raw/abc123"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => toast.info('Pastebin import coming soon!')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Import
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Upload
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-600">Drop ZIP file here or click to browse</p>
                      <input
                        type="file"
                        accept=".zip"
                        className="hidden"
                        onChange={() => toast.info('ZIP import coming soon!')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'environment' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Environment Variables</h3>
              <p className="text-sm text-gray-600">Configure environment variables for your bot</p>
              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="autoDetect"
                  checked={autoDetectEnabled}
                  onChange={(e) => setAutoDetectEnabled(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="autoDetect" className="ml-2 block text-sm text-gray-700">
                  Auto-detect variables from code changes
                </label>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSecrets(!showSecrets)}
                className="btn-secondary"
              >
                {showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}
                {showSecrets ? 'Hide' : 'Show'} Secrets
              </button>
              <button
                onClick={detectEnvironmentVariablesFromCode}
                className="btn-secondary"
              >
                <FileText size={16} />
                Detect from Code
              </button>
              <button
                onClick={autoFillEnvironmentVariables}
                className="btn-secondary"
              >
                <RefreshCw size={16} />
                Auto-fill Defaults
              </button>
              <button
                onClick={addEnvironmentVariable}
                className="btn-primary"
              >
                <Plus size={16} />
                Add Variable
              </button>
            </div>
          </div>

          {/* Help Information */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Bot Mode Information</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <div>
                <p className="font-medium">📡 Polling Mode (Default):</p>
                <p>• Bot continuously checks for new messages</p>
                <p>• May receive queued messages when restarted</p>
                <p>• Works on any hosting platform</p>
                <p>• Set <code className="bg-blue-100 px-1 rounded">BOT_MODE=polling</code></p>
              </div>
              <div>
                <p className="font-medium">🌐 Webhook Mode:</p>
                <p>• Telegram sends messages directly to your bot</p>
                <p>• No message queuing, instant responses</p>
                <p>• Requires HTTPS endpoint and public URL</p>
                <p>• Set <code className="bg-blue-100 px-1 rounded">BOT_MODE=webhook</code> and <code className="bg-blue-100 px-1 rounded">WEBHOOK_URL=https://your-domain.com/webhook</code></p>
              </div>
              <div>
                <p className="font-medium">🛡️ Message Deduplication:</p>
                <p>• Automatically prevents duplicate responses</p>
                <p>• Built-in rate limiting (100ms between messages)</p>
                <p>• Memory management (keeps last 1000 processed messages)</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {environmentVariables.map((envVar, index) => {
              // Check if this variable is used in the current code
              const isUsedInCode = code && (
                code.includes(`process.env.${envVar.key}`) ||
                code.includes(`process.env['${envVar.key}']`) ||
                code.includes(`process.env["${envVar.key}"]`) ||
                code.includes(`process.env[\`${envVar.key}\`]`)
              );

              return (
                <div key={index} className={`flex items-center space-x-3 p-4 border rounded-lg ${
                  isUsedInCode ? 'border-green-200 bg-green-50' : 'border-gray-200'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Variable name (e.g., API_KEY)"
                          value={envVar.key}
                          onChange={(e) => updateEnvironmentVariable(index, 'key', e.target.value)}
                          className="input"
                          list={`env-var-${index}`}
                        />
                        <datalist id={`env-var-${index}`}>
                          {commonEnvVars.map((suggestion, idx) => (
                            <option key={idx} value={suggestion} />
                          ))}
                        </datalist>
                      </div>
                      {isUsedInCode && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Used in code
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type={showSecrets || !envVar.isSecret ? "text" : "password"}
                        placeholder="Variable value"
                        value={envVar.value}
                        onChange={(e) => updateEnvironmentVariable(index, 'value', e.target.value)}
                        className="input flex-1"
                      />
                      <button
                        onClick={() => updateEnvironmentVariable(index, 'isSecret', !envVar.isSecret)}
                        className={`px-3 py-2 text-sm rounded-md ${
                          envVar.isSecret 
                            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {envVar.isSecret ? 'Secret' : 'Public'}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeEnvironmentVariable(index)}
                    className="text-red-600 hover:text-red-800 p-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={saveEnvironmentVariables}
              className="btn-primary"
            >
              <Save size={16} />
              Save Environment Variables
            </button>
          </div>
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Bot Errors</h3>
              <p className="text-sm text-gray-600">Real-time error logs and debugging information</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={clearErrors}
                className="btn-secondary"
              >
                <RefreshCw size={16} />
                Clear Errors
              </button>
            </div>
          </div>

          {errors.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle size={48} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Errors</h3>
              <p className="text-gray-600">Your bot is running without any errors!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {errors.map((error, index) => (
                <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle size={16} className="text-red-600" />
                      <span className="text-sm font-medium text-red-800">
                        Error #{index + 1}
                      </span>
                      <span className="text-xs text-red-600">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                    <button
                      onClick={() => copyError(formatError(error))}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Copy error"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <pre className="text-sm text-red-700 bg-red-100 p-3 rounded overflow-x-auto">
                    {formatError(error)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Bot Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={bot.name}
                  onChange={(e) => setBot({ ...bot, name: e.target.value })}
                  className="input mt-1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Language</label>
                <input
                  type="text"
                  value={bot.language}
                  disabled
                  className="input mt-1 bg-gray-50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Token</label>
                <input
                  type="password"
                  value={bot.token}
                  onChange={(e) => setBot({ ...bot, token: e.target.value })}
                  className="input mt-1"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoStart"
                  checked={bot.autoStart}
                  onChange={(e) => setBot({ ...bot, autoStart: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="autoStart" className="ml-2 block text-sm text-gray-900">
                  Auto-start on platform launch
                </label>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={async () => {
                  try {
                    await updateBot(botId, {
                      name: bot.name,
                      token: bot.token,
                      autoStart: bot.autoStart
                    });
                    toast.success('Bot settings saved!');
                  } catch (error) {
                    console.error('Failed to update bot:', error);
                    toast.error('Failed to save bot settings');
                  }
                }}
                className="btn-primary"
              >
                Save Settings
              </button>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Bot Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                {getStatusBadge()}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Created</span>
                <span className="text-sm text-gray-900">
                  {new Date(bot.createdAt).toLocaleString()}
                </span>
              </div>
              
              {bot.updatedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Updated</span>
                  <span className="text-sm text-gray-900">
                    {new Date(bot.updatedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotEditor;