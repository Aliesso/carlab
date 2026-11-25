import { fusion } from './fusion';
import { raptor } from './raptor';
import { bmw } from './bmw';

// every car has 9 build steps → 11 scroll sections (hero + 9 + final)
export const CARS = [fusion, raptor, bmw];
export const carById = (id) => CARS.find((c) => c.id === id) ?? CARS[0];

export const camsFor = (car) => [car.heroCam, ...car.steps.map((s) => s.cam), car.finalCam];
export const sidesFor = (car) => ['c', ...car.steps.map((s) => s.side), 'c'];
