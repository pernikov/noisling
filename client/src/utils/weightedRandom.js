export function getWeightedRandomValue(options, randomValue = Math.random()) {
  const weightedOptions = options
    .map(option => ({
      value: option.value,
      weight: Number.isFinite(option.weight) ? Math.max(0, option.weight) : 0,
    }))
    .filter(option => option.weight > 0);

  if (!weightedOptions.length) return null;

  const totalWeight = weightedOptions.reduce((total, option) => total + option.weight, 0);
  let remainingWeight = Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON) * totalWeight;

  for (const option of weightedOptions) {
    if (remainingWeight < option.weight) return option.value;
    remainingWeight -= option.weight;
  }

  return weightedOptions.at(-1).value;
}
