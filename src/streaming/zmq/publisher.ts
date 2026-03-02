import { Publisher } from 'zeromq';

export async function createPublisher(address = 'tcp://*:5555') {
  const sock = new Publisher();
  await sock.bind(address);
  console.info(`Publisher bound to ${address}`);

  return sock;
}

export async function publish(sock: Publisher, topic: string, data: unknown) {
  await sock.send([topic, JSON.stringify(data)]);
}
