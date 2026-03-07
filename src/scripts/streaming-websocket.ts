import { SchwabStreamer } from "../index.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function s_web(): Promise<void> {
  const streamer = new SchwabStreamer();

  try {
    await streamer.connect();
    await streamer.login();

    // await streamer.subs({
    //   service: "LEVELONE_FUTURES",
    //   keys: ["/ESH26"],
    //   fields: ["0", "1", "2", "3", "8", "10"],
    // });

    // await streamer.subsL1Futures({
    //   keys: ["/ESH26"],
    //   fields: [
    //     "symbol",
    //     "bidPrice",
    //     "askPrice",
    //     "lastPrice",
    //     "totalVolume",
    //     "highPrice",
    //     "quoteTime",
    //   ],
    // });

    await streamer.addL2NasdaqBook({
      keys: ["AMZN"],
      fields: ["symbol", "marketSnapshotTime", "bidSideLevels", "askSideLevels"],
    });

    // await streamer.subsChartEquity({
    //   keys: ["AAPL"],
    //   fields: ["symbol", "openPrice", "highPrice", "lowPrice", "closePrice", "volume", "chartTime"],
    // });

    await wait(10_000);

    // await streamer.add({
    //   service: "LEVELONE_EQUITIES",
    //   keys: ["MSFT"],
    //   fields: ["0", "1", "2", "3", "8", "10"],
    // });

    await wait(10_000);

    // await streamer.view({
    //   service: "LEVELONE_EQUITIES",
    //   fields: ["0", "1", "2", "3"],
    // });

    await wait(10_000);

    // await streamer.unsubs({
    //   service: "LEVELONE_EQUITIES",
    //   keys: ["AAPL"],
    // });

    await wait(10_000);

    await streamer.logout();
  } finally {
    await streamer.close();
  }
}

// void main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });
