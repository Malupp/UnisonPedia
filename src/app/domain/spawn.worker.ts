/// <reference lib="webworker" />
import {
  analyseGuaranteedTarget,
  simulateTarget,
  recommendSpawn,
  explainSpawn,
  buildBenchmark,
} from "./spawn";
addEventListener("message", ({ data }) => {
  if (data.type !== "run") return;
  try {
    const {
      banner,
      profile,
      progress,
      targetAssessment,
      targetItemId,
      risk,
      custom,
      itemNames,
    } = data.payload;
    const guaranteed = analyseGuaranteedTarget(banner, {
      ...progress,
      targetItemId,
    });
    let simulation = null,
      simulationError = "";
    try {
      simulation = simulateTarget(banner, {
        ...progress,
        targetItemId,
        budgetGems: Math.max(0, profile.availableGems - profile.reserveGems),
        trials: 10000,
        seed: 42,
        maxAttempts: 2000,
      });
    } catch (e) {
      simulationError = (e as Error).message;
    }
    const advice = recommendSpawn({
      banner,
      profile,
      progress,
      targetAssessment,
      targetItemId,
      risk,
      custom,
      guaranteed,
      simulation,
      benchmark: data.payload.benchmarkTarget
        ? buildBenchmark(
            data.payload.benchmarkRecords || [],
            data.payload.benchmarkTarget,
          )
        : null,
      alternatives: [],
    });
    postMessage({
      type: "result",
      requestId: data.requestId,
      payload: {
        advice,
        explanation: explainSpawn(advice, { profile, itemNames }),
        simulation,
        simulationError,
        guaranteed,
      },
    });
  } catch (e) {
    postMessage({
      type: "error",
      requestId: data.requestId,
      payload: (e as Error).message,
    });
  }
});
