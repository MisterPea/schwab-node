import { Subscriber } from "zeromq";

export async function createSubscriber(
  address = "tcp://localhost:5555",
  topics = ["schwab"],
) {
  const sock = new Subscriber();
  sock.connect(address);

  for (const topic of topics) {
    sock.subscribe(topic);
  }

  console.info(`Subscribed to ${topics.join(", ")} on ${address}`);
  return sock;
}

export async function listen(
  sock: Subscriber,
  onMessage: (topic: string, message: unknown) => void,
) {
  for await (const [topic, data] of sock) {
    onMessage(topic.toString(), JSON.parse(data.toString()));
  }
}
