import initializeServices from './app';

// Resilience net: a single round's bug (often an unhandled rejection deep in an
// async game flow) must never kill the process and disconnect every player. Log
// loudly and keep the server alive instead.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
});

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
