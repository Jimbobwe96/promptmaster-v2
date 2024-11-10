import initializeServices from './app';

async function start() {
  try {
    await initializeServices;
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

start();
