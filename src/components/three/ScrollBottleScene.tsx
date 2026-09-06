import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMotionValueEvent, type MotionValue } from 'framer-motion'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getProductById } from '../../data/products'
import { ProductModel } from './ProductModel'

const featuredOil = getProductById('onion-hair-oil')
const trackPoints = [0, 0.24, 0.5, 0.76, 1] as const

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

function sampleTrack(values: readonly number[], progress: number) {
  const safeProgress = THREE.MathUtils.clamp(progress, 0, 1)

  for (let index = 0; index < trackPoints.length - 1; index += 1) {
    const start = trackPoints[index]
    const end = trackPoints[index + 1]
    if (safeProgress <= end) {
      const local = smoothstep((safeProgress - start) / (end - start))
      return THREE.MathUtils.lerp(values[index], values[index + 1], local)
    }
  }

  return values.at(-1) ?? 0
}

function MovingOilBottle({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null)
  const invalidate = useThree((state) => state.invalidate)

  useMotionValueEvent(progress, 'change', invalidate)

  useEffect(() => {
    invalidate()
  }, [invalidate])

  useFrame(() => {
    if (!group.current) return
    const value = progress.get()

    group.current.position.set(
      sampleTrack([0.05, -0.08, 0.12, -0.05, 0], value),
      sampleTrack([0.08, -0.04, 0.04, -0.02, -0.12], value),
      sampleTrack([0, 0.18, -0.08, 0.12, -0.16], value),
    )
    group.current.rotation.set(
      sampleTrack([-0.025, 0.015, -0.012, 0.018, 0], value),
      sampleTrack([-0.16, 0.12, -0.2, 0.14, 0.04], value),
      0,
    )
    group.current.scale.setScalar(sampleTrack([1.04, 0.92, 0.96, 0.9, 0.84], value))
  })

  return (
    <group ref={group} position={[0, 0.08, 0]} scale={1.04}>
      <ProductModel product={featuredOil} />
    </group>
  )
}

export function ScrollBottleCanvas({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.35]}
      camera={{ fov: 28, position: [0, 0.05, 6.7], near: 0.1, far: 30 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.domElement.setAttribute('aria-hidden', 'true')
        gl.domElement.tabIndex = -1
      }}
    >
      <Suspense fallback={null}>
        <MovingOilBottle progress={progress} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[4, 5, 5]} intensity={2.3} color="#fff8ed" />
        <directionalLight position={[-3, 1, 3]} intensity={1.15} color="#d9c4ee" />
        <Environment resolution={96}>
          <Lightformer form="rect" intensity={3.4} position={[4, 4, 3]} scale={[4, 5, 1]} />
          <Lightformer form="rect" intensity={1.8} position={[-4, 1, 2]} scale={[3, 5, 1]} />
          <Lightformer form="ring" intensity={1.1} position={[0, 4, -4]} scale={4} />
        </Environment>
      </Suspense>
    </Canvas>
  )
}
