/**
 * Minimal React stub so pure helpers exported from hook modules can be
 * imported (and unit-tested) by the standalone runner outside the Superset
 * tree. Hook implementations are dummies — only module resolution and
 * hook-free pure functions are exercised here.
 */
export const useCallback = fn => fn;
export const useContext = () => undefined;
export const useEffect = () => {};
export const useMemo = fn => fn();
export const useReducer = (reducer, initialArg) => [
  typeof initialArg === "function" ? initialArg() : initialArg,
  () => {},
];
export const useRef = initial => ({ current: initial });
export const useState = initial => [
  typeof initial === "function" ? initial() : initial,
  () => {},
];

export default {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
};
