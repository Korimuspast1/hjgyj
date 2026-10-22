/* Статический поиск необъявленных идентификаторов в js/.
   Именно такие ошибки (использовал `$`, `OPERATORS`, `rndInt`, `chev`, `notifCard` без импорта)
   не ловятся ни парсером, ни запуском — они выстреливают только на конкретном пути кода,
   уже у игрока. Сканер собирает ВСЕ объявления файла (импорты, var/let/const, функции,
   классы, параметры, catch) в один набор и сообщает об именах, которых в нём нет.

   Запуск: cd tests && node undeclared.mjs   (нужны acorn, acorn-walk) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = path.join(ROOT, 'js');

/* Встроенные глобалы браузера и среды — их отсутствие импорта ошибкой не считается */
const GLOBALS = new Set(`
globalThis window self top parent document navigator location history localStorage sessionStorage
console alert prompt confirm fetch atob btoa getComputedStyle matchMedia getSelection
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame
queueMicrotask requestIdleCallback cancelIdleCallback postMessage close open focus blur print
scroll scrollTo scrollBy structuredClone devicePixelRatio innerWidth innerHeight outerWidth outerHeight
scrollX scrollY pageXOffset pageYOffset screen performance crypto
URL URLSearchParams Blob File FileReader FormData TextEncoder TextDecoder AbortController AbortSignal
Event CustomEvent KeyboardEvent MouseEvent PointerEvent TouchEvent WheelEvent InputEvent UIEvent
ErrorEvent DragEvent ClipboardEvent FocusEvent AnimationEvent TransitionEvent PopStateEvent EventTarget
Element HTMLElement Node NodeList HTMLCollection DocumentFragment DOMParser XMLSerializer
MediaQueryList MutationObserver IntersectionObserver ResizeObserver PerformanceObserver
Audio AudioContext webkitAudioContext OfflineAudioContext OscillatorNode GainNode AnalyserNode
AudioBuffer AudioBufferSourceNode BiquadFilterNode DynamicsCompressorNode StereoPannerNode
WaveShaperNode DelayNode ConvolverNode MediaElementAudioSourceNode AudioParam AudioListener
Image CanvasRenderingContext2D Path2D DOMMatrix DOMPoint OffscreenCanvas CanvasGradient
Intl JSON Math Number String Boolean Object Array Symbol Map Set WeakMap WeakSet WeakRef Proxy Reflect Promise Date RegExp
Error TypeError RangeError SyntaxError ReferenceError EvalError URIError AggregateError
ArrayBuffer DataView Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array
Uint32Array Float32Array Float64Array BigInt64Array BigUint64Array BigInt Atomics SharedArrayBuffer FinalizationRegistry
isNaN isFinite parseInt parseFloat encodeURI encodeURIComponent decodeURI decodeURIComponent escape unescape eval
undefined NaN Infinity
WebSocket Worker ServiceWorker SharedWorker BroadcastChannel MessageChannel MessagePort XMLHttpRequest EventSource
Headers Request Response Storage IDBFactory IndexedDB DOMException MediaQueryList Navigator Screen
process global Buffer module exports require __dirname __filename
`.split(/\s+/).filter(Boolean));

const files = [];
(function collect(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(JS_DIR);

let problems = 0, parsed = 0;

function addPattern(set, pat) {
  if (!pat) return;
  switch (pat.type) {
    case 'Identifier': set.add(pat.name); break;
    case 'ObjectPattern': pat.properties.forEach((p) => addPattern(set, p.value || p.argument)); break;
    case 'ArrayPattern': pat.elements.forEach((e) => addPattern(set, e)); break;
    case 'AssignmentPattern': addPattern(set, pat.left); break;
    case 'RestElement': addPattern(set, pat.argument); break;
    default: break;
  }
}

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    parsed++;
  } catch (e) {
    problems++;
    console.log(`❌ ${rel}: ОШИБКА РАЗБОРА — ${e.message}`);
    continue;
  }

  /* 1) все объявленные в файле имена */
  const declared = new Set();
  walk.full(ast, (node) => {
    switch (node.type) {
      case 'ImportDeclaration':
        node.specifiers.forEach((s) => declared.add(s.local.name));
        break;
      case 'VariableDeclarator':
        addPattern(declared, node.id);
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ClassDeclaration':
      case 'ClassExpression':
        if (node.id) declared.add(node.id.name);
        if (node.params) node.params.forEach((p) => addPattern(declared, p));
        break;
      case 'CatchClause':
        addPattern(declared, node.param);
        break;
      default: break;
    }
  });

  /* 2) все обращения: ищем те, которых нет ни среди объявлений, ни среди глобалов */
  const reported = new Set();
  walk.fullAncestor(ast, (node, ancestors) => {
    if (node.type !== 'Identifier') return;
    const parent = ancestors[ancestors.length - 2];
    if (!parent) return;
    // это не обращение, а часть объявления/ключа/импорта
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
    if (parent.type === 'Property' && parent.key === node && !parent.computed) return;
    if (parent.type === 'MethodDefinition' && parent.key === node) return;
    if (/^(Import|Export)(Specifier|DefaultSpecifier|NamespaceSpecifier)$/.test(parent.type)) return;
    if (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') return;
    if (parent.type === 'VariableDeclarator' && parent.id === node) return;
    if ((parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' ||
         parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression') && parent.id === node) return;
    if (parent.type === 'MetaProperty') return;
    if (declared.has(node.name) || GLOBALS.has(node.name)) return;

    const key = node.name;
    if (reported.has(key)) return;
    reported.add(key);
    problems++;
    console.log(`⚠️  ${rel}:${node.loc.start.line}:${node.loc.start.column} — «${node.name}» не объявлен и не импортирован`);
  });
}

console.log('');
console.log(problems === 0
  ? `✅ Файлов разобрано: ${parsed}. Необъявленных идентификаторов не найдено.`
  : `❌ Файлов разобрано: ${parsed}, замечаний: ${problems}`);
process.exit(problems === 0 ? 0 : 1);
