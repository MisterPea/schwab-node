import { createSubscriber, listen } from '../streaming/zmq/subscriber.js';

export async function s_sub(): Promise<void> {
  const subscriber = await createSubscriber('tcp://localhost:5555', ['schwab']);

  await listen(subscriber, (topic, message) => {
    console.log(topic, JSON.stringify(message, null, 2));
  });
}

// void main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });
