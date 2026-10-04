'use client';

import { useEffect, useMemo, useRef } from 'react'
// 用 gsap 的核心模块，而不是 `gsap` 入口 —— 后者的 index.js 会把
// ScrollTrigger / Draggable / Flip 等全部再导出，打包体积约 136 KB，
// 而本组件只用到 tween。滚动触发改由 IntersectionObserver 实现（见下）。
import { gsap } from 'gsap/gsap-core.js'

import './FoldText.css'

const HINGE_CONFIG = {
  top: { origin: '50% 0%', rotateX: -92, rotateY: 0 },
  bottom: { origin: '50% 100%', rotateX: 92, rotateY: 0 },
  left: { origin: '0% 50%', rotateX: 0, rotateY: 92 },
  right: { origin: '100% 50%', rotateX: 0, rotateY: -92 }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const renderWhitespace = (value, key) =>
  value.split(/(\n)/).map((part, index) => {
    if (part === '\n') return <br key={`${key}-br-${index}`} />;
    if (!part) return null;

    return (
      <span className="fold-text-whitespace" key={`${key}-space-${index}`}>
        {part.replace(/ /g, '\u00A0')}
      </span>
    );
  });

const FoldText = ({
  text = 'Design unfolds',
  splitBy = 'char',
  hinge = 'top',
  duration = 0.65,
  stagger = 0.045,
  ease = 'power3.out',
  perspective = 700,
  creaseShading = 0.55,
  trigger = 'mount',
  // 本站补充：首屏用延迟而不是滚动来编排入场，让视频先稳住再翻开文字
  delay = 0,
  // 本站补充：中文标题需要比上游默认更松的行高与字距
  lineHeight,
  letterSpacing,
  fontSize = 80,
  fontWeight = 800,
  color = '#f7f2e8',
  className = '',
  style = {}
}) => {
  const rootRef = useRef(null);
  const timelineRef = useRef(null);
  const hingeConfig = HINGE_CONFIG[hinge] || HINGE_CONFIG.top;
  const safeCrease = clamp(creaseShading, 0, 1);
  const safePerspective = Math.max(120, perspective);
  const safeDelay = Math.max(0, delay);

  const segments = useMemo(() => {
    let segmentIndex = 0;

    const renderSegment = (content, key, split = splitBy) => {
      segmentIndex += 1;
      return (
        <span
          className="fold-text-segment"
          data-fold-split={split}
          key={key}
          style={{ '--fold-perspective': `${safePerspective}px` }}
        >
          <span
            className="fold-text-piece"
            data-fold-hinge={hinge}
            style={{ transformOrigin: hingeConfig.origin, '--fold-crease': 0 }}
          >
            {content || '\u00A0'}
          </span>
        </span>
      );
    };

    if (splitBy === 'line') {
      return text.split('\n').map((line, index) => (
        <span className="fold-text-line" key={`line-${index}`}>
          {renderSegment(line || '\u00A0', `segment-line-${index}`, 'line')}
        </span>
      ));
    }

    if (splitBy === 'word') {
      return text.split(/(\s+)/).flatMap((part, index) => {
        if (!part) return [];
        if (/^\s+$/.test(part)) return renderWhitespace(part, `ws-${index}`);
        return renderSegment(part, `segment-word-${segmentIndex}`);
      });
    }

    return Array.from(text).map((char, index) => {
      if (char === '\n') return <br key={`br-${index}`} />;
      return renderSegment(char === ' ' ? '\u00A0' : char, `segment-char-${index}`);
    });
  }, [text, splitBy, hinge, hingeConfig.origin, safePerspective]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const root = rootRef.current;
    if (!root) return undefined;

    const pieces = Array.from(root.querySelectorAll('.fold-text-piece'));
    if (!pieces.length) return undefined;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const activeDuration = reduceMotion ? Math.min(duration, 0.22) : duration;
    const activeStagger = reduceMotion ? Math.min(stagger, 0.02) : stagger;
    const fromVars = {
      opacity: 0,
      rotateX: reduceMotion ? 0 : hingeConfig.rotateX,
      rotateY: reduceMotion ? 0 : hingeConfig.rotateY,
      '--fold-crease': reduceMotion ? 0 : safeCrease,
      transformOrigin: hingeConfig.origin,
      force3D: true
    };
    const toVars = {
      opacity: 1,
      rotateX: 0,
      rotateY: 0,
      '--fold-crease': 0,
      duration: activeDuration,
      ease: reduceMotion ? 'power1.out' : ease,
      stagger: activeStagger,
      clearProps: 'willChange'
    };

    const killTimeline = () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      gsap.killTweensOf(pieces);
    };

    const play = repeat => {
      killTimeline();
      timelineRef.current = gsap.timeline({ repeat: repeat ? -1 : 0, repeatDelay: repeat ? 0.75 : 0 });
      if (safeDelay) timelineRef.current.delay(safeDelay);
      timelineRef.current.fromTo(pieces, fromVars, toVars);
      return timelineRef.current;
    };

    let scrollObserver;
    let hoverHandler;

    if (trigger === 'hover') {
      gsap.set(pieces, { opacity: 1, rotateX: 0, rotateY: 0, '--fold-crease': 0, transformOrigin: hingeConfig.origin });
      hoverHandler = () => play(false);
      root.addEventListener('mouseenter', hoverHandler);
    } else if (trigger === 'scroll') {
      // 本站改动：原来用 ScrollTrigger.create({ start: 'top 82%' })。
      // 为了不把整个 ScrollTrigger（约 110 KB 源码）打进首屏包，
      // 这里用 IntersectionObserver 实现等价语义 —— 元素进入视口 82% 处时触发一次。
      gsap.set(pieces, fromVars);
      if (typeof IntersectionObserver === 'undefined') {
        play(false);
      } else {
        scrollObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              scrollObserver.disconnect();
              play(false);
            });
          },
          { rootMargin: '0px 0px -18% 0px', threshold: 0.01 }
        );
        scrollObserver.observe(root);
      }
    } else if (trigger === 'loop') {
      play(true);
    } else {
      play(false);
    }

    return () => {
      if (hoverHandler) root.removeEventListener('mouseenter', hoverHandler);
      scrollObserver?.disconnect();
      killTimeline();
    };
  }, [
    text,
    splitBy,
    hinge,
    duration,
    stagger,
    ease,
    perspective,
    safeCrease,
    safeDelay,
    trigger,
    hingeConfig.origin,
    hingeConfig.rotateX,
    hingeConfig.rotateY
  ]);

  const rootStyle = {
    '--fold-text-font-size': typeof fontSize === 'number' ? `${fontSize}px` : fontSize,
    '--fold-text-font-weight': fontWeight,
    '--fold-text-color': color,
    ...(lineHeight ? { '--fold-text-line-height': lineHeight } : null),
    ...(letterSpacing ? { '--fold-text-tracking': letterSpacing } : null),
    ...style
  };

  return (
    <span ref={rootRef} className={`fold-text ${className}`.trim()} style={rootStyle}>
      <span className="fold-text-sr-only">{text}</span>
      <span className="fold-text-visual" aria-hidden="true">
        {segments}
      </span>
    </span>
  );
};

export default FoldText;
