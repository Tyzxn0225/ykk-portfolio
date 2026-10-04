import { useEffect, useMemo, useRef } from 'react'
import './BorderGlow.css'

/**
 * 把 React Bits · BorderGlow 的辉光效果抽出来，供其他元素复用。
 *
 * 为什么要抽：
 * BorderGlow 本体是一个 `<div>` 卡片容器，它会自带 border-radius、背景色和边框。
 * 本站的按钮是圆角胶囊形的 <a> / <button>，如果套进 BorderGlow 会变成方块，
 * 同时把 <a> 塞进 <div> 也会让键盘语义变差。所以按钮这类元素不套外壳，
 * 而是复用同一套配色变量 + 指针跟踪逻辑，样式直接作用在元素自己身上。
 */

function parseHSL(hslStr) {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/)
  if (!match) return { h: 40, s: 80, l: 80 }
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) }
}

/** 与 BorderGlow 内部完全一致的辉光色阶 */
export function buildGlowVars(glowColor, intensity = 1) {
  const { h, s, l } = parseHSL(glowColor)
  const base = `${h}deg ${s}% ${l}%`
  const opacities = [100, 60, 50, 40, 30, 20, 10]
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10']
  const vars = {}
  for (let i = 0; i < opacities.length; i += 1) {
    vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`
  }
  return vars
}

const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%']
const GRADIENT_KEYS = [
  '--gradient-one',
  '--gradient-two',
  '--gradient-three',
  '--gradient-four',
  '--gradient-five',
  '--gradient-six',
  '--gradient-seven',
]
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1]

/** 与 BorderGlow 内部完全一致的网格渐变 */
export function buildGradientVars(colors) {
  const vars = {}
  for (let i = 0; i < 7; i += 1) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)]
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`
  }
  vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`
  return vars
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

/**
 * 跟踪指针在元素内相对边缘的位置与方位角，写入 --edge-proximity / --cursor-angle。
 * 算法与 BorderGlow 内部保持一致，只是作用在传入的元素上。
 */
export function useEdgeGlow({ disabled = false } = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || disabled) return undefined
    // 触摸设备没有 hover，直接跳过
    if (typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches) return undefined

    let raf = 0
    let lastX = 0
    let lastY = 0

    const apply = () => {
      const rect = el.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const x = lastX - rect.left
      const y = lastY - rect.top
      const dx = x - cx
      const dy = y - cy

      let kx = Infinity
      let ky = Infinity
      if (dx !== 0) kx = cx / Math.abs(dx)
      if (dy !== 0) ky = cy / Math.abs(dy)
      const edge = clamp(1 / Math.min(kx, ky), 0, 1)

      let degrees = Math.atan2(dy, dx) * (180 / Math.PI) + 90
      if (degrees < 0) degrees += 360

      el.style.setProperty('--edge-proximity', (edge * 100).toFixed(3))
      el.style.setProperty('--cursor-angle', `${degrees.toFixed(3)}deg`)
    }

    const onMove = (e) => {
      lastX = e.clientX
      lastY = e.clientY
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      cancelAnimationFrame(raf)
      el.style.setProperty('--edge-proximity', '0')
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('blur', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('blur', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [disabled])

  return ref
}

/**
 * 一站式的「按钮辉光」：返回 ref 与要摊到元素上的 CSS 变量。
 *
 *   const { ref, style } = useButtonGlow()
 *   <a ref={ref} style={style}>…</a>
 */
export function useButtonGlow({
  glowColor = '225 96 56',
  glowIntensity = 1.4,
  colors = ['#2f5cff', '#7aa2ff', '#c8a878'],
  edgeSensitivity = 10,
  coneSpread = 34,
  disabled = false,
} = {}) {
  const ref = useEdgeGlow({ disabled })

  const style = useMemo(
    () => ({
      '--edge-sensitivity': edgeSensitivity,
      '--cone-spread': coneSpread,
      ...buildGlowVars(glowColor, glowIntensity),
      ...buildGradientVars(colors),
    }),
    [glowColor, glowIntensity, colors, edgeSensitivity, coneSpread],
  )

  return { ref, style }
}
