const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

class PythonManager {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    this.initTimeout = null;
    this.isInitializing = false;
    this.explicitlyStopped = false;
  }

  init() {
    if (this.worker || this.isInitializing) return;
    this.isInitializing = true;

    console.log('🐍 Initializing persistent Python worker...');
    
    const scriptPath = path.join(__dirname, '..', 'python_worker.py');
    this.worker = spawn('python', [scriptPath]);

    const rl = readline.createInterface({
      input: this.worker.stdout,
      terminal: false
    });

    rl.on('line', (line) => {
      if (line === 'READY') {
        console.log('✅ Python worker is READY and models are loaded.');
        this.ready = true;
        this.isInitializing = false;
        return;
      }

      try {
        const response = JSON.parse(line);
        const { id } = response;
        if (id !== undefined && this.pendingRequests.has(id)) {
          const { resolve } = this.pendingRequests.get(id);
          this.pendingRequests.delete(id);
          resolve(response);
        }
      } catch (e) {
        console.error('❌ Error parsing Python worker output:', line);
      }
    });

    this.worker.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg.startsWith('DEBUG:')) {
        console.log(`[Python Debug] ${msg.replace('DEBUG: ', '')}`);
      } else {
        console.error(`[Python Error] ${msg}`);
      }
    });

    this.worker.on('close', (code) => {
      console.log(`🐍 Python worker exited with code ${code}`);
      this.ready = false;
      this.worker = null;
      this.isInitializing = false;
      // Auto-restart after a delay if not explicitly stopped
      if (!this.explicitlyStopped) {
        setTimeout(() => this.init(), 5000);
      }
    });
  }

  restart() {
    console.log('🔄 Restarting Python worker to apply changes...');
    if (this.worker) {
      this.explicitlyStopped = false; // Ensure it auto-restarts
      this.worker.kill();
    } else {
      this.init();
    }
  }

  async sendTask(task, params) {
    if (!this.ready) {
      if (!this.worker) this.init();
      // Wait for ready or timeout
      await new Promise((resolve) => {
        const checkReady = setInterval(() => {
          if (this.ready) {
            clearInterval(checkReady);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkReady);
          resolve();
        }, 60000); // Increased to 60s for first-time lazy loading
      });
    }

    if (!this.ready) {
      throw new Error('Python worker not ready after timeout');
    }

    const id = this.requestIdCounter++;
    const request = { id, task, ...params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async verifyImage(imagePath, categories) {
    const result = await this.sendTask('image_verify', { image_path: imagePath, categories });
    return result.scores || {};
  }

  async verifyAuthenticity(imagePath) {
    const result = await this.sendTask('authenticity', { image_path: imagePath });
    return result.auth || { score: 0, is_authentic: false };
  }

  async analyzeImage(imagePath, categories) {
    const result = await this.sendTask('analyze_image', { image_path: imagePath, categories });
    return result.analysis || { scores: {}, auth: { score: 0, is_authentic: false } };
  }

  async handleNLPQuery(query, context = "") {
    try {
      const result = await this.sendTask('nlp_query', { query, context });
      return result.response || "I'm sorry, I couldn't process that locally.";
    } catch (error) {
      console.error('NLP Query Error:', error);
      return "Local NLP service is currently unavailable.";
    }
  }
}

// Singleton instance
const pythonManager = new PythonManager();
pythonManager.init();

module.exports = pythonManager;
