// ======================================================================
// [NODE_TYPE: STARTUP_ORCHESTRATOR]
// ======================================================================
// Purpose: Start both the Telegram bot and web server with a single command
// Input: None (run as: node start.js)
// Output: Running bot and server processes with combined logs

const { spawn } = require('child_process');
const path = require('path');

// ======================================================================
// [NODE_TYPE: PROCESS_MANAGER_NODE]
// ======================================================================
// Purpose: Manage child processes and handle their lifecycle
// Input: Process commands and arguments
// Output: Running processes with forwarded output

// Color codes for better log visualization
const colors = {
  reset: '\x1b[0m',
  bot: '\x1b[36m', // Cyan for bot
  server: '\x1b[35m', // Magenta for server
  error: '\x1b[31m', // Red for errors
  success: '\x1b[32m' // Green for success
};

/**
 * Spawns a child process and handles its output
 * @param {string} command - The command to run
 * @param {string[]} args - Command arguments
 * @param {string} name - Process name for logging
 * @param {string} color - Color code for this process logs
 * @returns {ChildProcess} - The spawned process
 */
function spawnProcess(command, args, name, color) {
  console.log(`${color}🚀 [STARTUP/${name}] Starting ${name}...${colors.reset}`);
  
  const childProcess = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });
  
  // Forward stdout with process name prefix
  childProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${color}[${name}] ${line}${colors.reset}`);
      }
    });
  });
  
  // Forward stderr with process name prefix
  childProcess.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${colors.error}[${name}/ERROR] ${line}${colors.reset}`);
      }
    });
  });
  
  // Handle process exit
  childProcess.on('exit', (code) => {
    if (code === 0) {
      console.log(`${colors.success}✅ [STARTUP/${name}] Process exited successfully${colors.reset}`);
    } else {
      console.log(`${colors.error}❌ [STARTUP/${name}] Process exited with code ${code}${colors.reset}`);
    }
  });
  
  // Handle process errors
  childProcess.on('error', (err) => {
    console.log(`${colors.error}❌ [STARTUP/${name}] Failed to start: ${err.message}${colors.reset}`);
  });
  
  return childProcess;
}

// ======================================================================
// [NODE_TYPE: STARTUP_NODE]
// ======================================================================
// Purpose: Start all required processes
// Input: None
// Output: Running bot and server processes

console.log(`🔄 [STARTUP] Starting Kambo Klarity system at ${new Date().toISOString()}`);

// Start the bot
const botProcess = spawnProcess('node', ['bot.js'], 'BOT', colors.bot);

// Start the server
const serverProcess = spawnProcess('node', ['server.js'], 'SERVER', colors.server);

// Handle main process termination
process.on('SIGINT', () => {
  console.log('\n💤 [STARTUP] Shutting down all processes...');
  
  // Kill child processes
  botProcess.kill('SIGINT');
  serverProcess.kill('SIGINT');
  
  // Give processes time to clean up, then exit
  setTimeout(() => {
    console.log('👋 [STARTUP] Goodbye!');
    process.exit(0);
  }, 1000);
});

console.log('✅ [STARTUP] All processes started. Press Ctrl+C to stop everything.');
