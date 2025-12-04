// Test script for Dampened Velocity Method

const DAYS_PER_MONTH = 30.44;

function calculateDampenedVelocity(competitions) {
  if (competitions.length < 2) return null;

  const sorted = [...competitions].sort((a, b) => a.date - b.date);

  const first = sorted[0];
  const secondToLast = sorted[sorted.length - 2];
  const last = sorted[sorted.length - 1];

  const monthsBetweenLastTwo =
    (last.date - secondToLast.date) / (1000 * 60 * 60 * 24 * DAYS_PER_MONTH);

  const monthsOverall =
    (last.date - first.date) / (1000 * 60 * 60 * 24 * DAYS_PER_MONTH);

  const vRecent = monthsBetweenLastTwo > 0
    ? (last.total - secondToLast.total) / monthsBetweenLastTwo
    : 0;

  const vOverall = monthsOverall > 0
    ? (last.total - first.total) / monthsOverall
    : 0;

  const vWeighted = (0.7 * vRecent) + (0.3 * vOverall);
  const finalVelocity = vWeighted * 0.9;

  return {
    vRecent,
    vOverall,
    vWeighted,
    finalVelocity
  };
}

function predictTotal(competitions, targetDate) {
  const velocity = calculateDampenedVelocity(competitions);
  if (!velocity) return null;

  const sorted = [...competitions].sort((a, b) => a.date - b.date);
  const lastComp = sorted[sorted.length - 1];

  const monthsToFuture =
    (targetDate - lastComp.date) / (1000 * 60 * 60 * 24 * DAYS_PER_MONTH);

  let predictedTotal = lastComp.total + (monthsToFuture * velocity.finalVelocity);
  predictedTotal = Math.round(predictedTotal / 2.5) * 2.5;

  return {
    predictedTotal,
    velocity
  };
}

// Helper to create dates relative to now
const now = new Date();
const monthsAgo = (months) => new Date(now.getTime() - months * 30.44 * 24 * 60 * 60 * 1000);
const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const monthsFromNow = (months) => new Date(now.getTime() + months * 30.44 * 24 * 60 * 60 * 1000);

console.log('========================================');
console.log('SCENARIO A: The Steady Veteran');
console.log('========================================');

const scenarioA = [
  { date: monthsAgo(18), total: 600 },
  { date: monthsAgo(12), total: 605 },
  { date: monthsAgo(6), total: 610 }
];

const targetA = monthsFromNow(6);
const resultA = predictTotal(scenarioA, targetA);

console.log('Historical Data:');
console.log('  18 months ago: 600 kg');
console.log('  12 months ago: 605 kg');
console.log('  6 months ago: 610 kg');
console.log('\nVelocity Breakdown:');
console.log(`  V_recent: ${resultA.velocity.vRecent.toFixed(2)} kg/month`);
console.log(`  V_overall: ${resultA.velocity.vOverall.toFixed(2)} kg/month`);
console.log(`  V_weighted: ${resultA.velocity.vWeighted.toFixed(2)} kg/month`);
console.log(`  Final Velocity (with 0.9 friction): ${resultA.velocity.finalVelocity.toFixed(2)} kg/month`);
console.log('\nPrediction for 6 months from now (12 months from last comp):');
console.log(`  Months from last comp to target: 12`);
console.log(`  Gain: 0.75 kg/month × 12 months = 9 kg`);
console.log(`  Predicted Total: ${resultA.predictedTotal} kg`);
console.log(`  Expected (user spec): ~614.5 kg`);
console.log(`  Expected (algorithm): 610 + 9 = 619 kg → rounds to 620 kg`);
console.log(`  Note: User expected 614.5 kg assumes 6 months from last comp (not from now)`);

console.log('\n========================================');
console.log('SCENARIO B: The Fast Novice');
console.log('========================================');

const scenarioB = [
  { date: monthsAgo(18), total: 400 },
  { date: monthsAgo(9), total: 450 },
  { date: daysAgo(7), total: 500 }
];

const targetB = monthsFromNow(3);
const resultB = predictTotal(scenarioB, targetB);

console.log('Historical Data:');
console.log('  18 months ago: 400 kg');
console.log('  9 months ago: 450 kg');
console.log('  1 week ago: 500 kg');
console.log('\nVelocity Breakdown:');
console.log(`  V_recent: ${resultB.velocity.vRecent.toFixed(2)} kg/month`);
console.log(`  V_overall: ${resultB.velocity.vOverall.toFixed(2)} kg/month`);
console.log(`  V_weighted: ${resultB.velocity.vWeighted.toFixed(2)} kg/month`);
console.log(`  Final Velocity (with 0.9 friction): ${resultB.velocity.finalVelocity.toFixed(2)} kg/month`);
console.log('\nPrediction for 3 months from now:');
console.log(`  Predicted Total: ${resultB.predictedTotal} kg`);
console.log(`  Expected: ~515 kg`);
console.log(`  Match: ${Math.abs(resultB.predictedTotal - 515) < 10 ? '✓' : '✗'}`);

console.log('\n========================================');
