import './style.css';
import { App } from './app';

const canvas = document.getElementById('c') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas #c not found');

new App(canvas);
