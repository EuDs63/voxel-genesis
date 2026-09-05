import type { StepResult } from '../sim/ca';

export interface TrendPoint extends StepResult { generation: number }

export class PopulationTrend {
  readonly points: TrendPoint[] = [];
  constructor(private readonly limit = 120) {}
  reset(generation: number, population: number): void {
    this.points.splice(0, this.points.length, { generation, population, births: 0, deaths: 0 });
  }
  push(generation: number, result: StepResult): void {
    this.points.push({ generation, ...result });
    if (this.points.length > this.limit) this.points.splice(0, this.points.length - this.limit);
  }
  path(width = 260, height = 56): string {
    if (!this.points.length) return '';
    const max = Math.max(1, ...this.points.map((p) => p.population));
    return this.points.map((p, i) => {
      const x = this.points.length === 1 ? 0 : i * width / (this.points.length - 1);
      const y = height - p.population * height / max;
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
}
