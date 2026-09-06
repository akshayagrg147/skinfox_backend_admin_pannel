import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { getProductById } from '../../data/products'
import { ProductModel } from './ProductModel'

const shampoo = getProductById('onion-shampoo')
const hairOil = getProductById('onion-hair-oil')
const hydrelle = getProductById('hydrelle-dry-skin-specialist')
const treatment = getProductById('intensive-scalp-hair-treatment')

function HeroComposition() {
  const group = useRef<THREE.Group>(null)
  const { pointer, size } = useThree()
  const compact = size.width < 650

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const time = clock.getElapsedTime()
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, pointer.x * 0.13 + Math.sin(time * 0.22) * 0.05, 4, delta)
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -pointer.y * 0.055, 4, delta)
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, Math.sin(time * 0.55) * 0.045, 3, delta)
  })

  return (
    <>
      <group ref={group} position={[compact ? -0.08 : 0.24, compact ? -0.68 : -0.42, 0]} scale={compact ? 0.76 : 0.76}>
        <ProductModel
          product={shampoo}
          position={[-0.3, 0.02, 0.55]}
          rotation={[0, -0.16, -0.035]}
          scale={0.86}
        />
        {!compact && (
          <>
            <ProductModel product={treatment} position={[1.04, -0.2, -0.02]} rotation={[0, -0.28, 0.035]} scale={0.68} />
            <ProductModel product={hydrelle} position={[-1.6, -0.58, -0.52]} rotation={[0, 0.34, 0]} scale={0.64} />
            <ProductModel product={hairOil} position={[2.02, -0.62, -0.72]} rotation={[0, -0.32, 0.055]} scale={0.56} />
          </>
        )}
        <mesh position={[-1.8, 1.5, -0.8]}>
          <sphereGeometry args={[0.2, 24, 18]} />
          <meshPhysicalMaterial color="#d6bdde" roughness={0.12} transmission={0.45} thickness={0.6} />
        </mesh>
        <mesh position={[1.72, 1.25, -0.35]} scale={0.7}>
          <sphereGeometry args={[0.24, 24, 18]} />
          <meshPhysicalMaterial color="#c9a34f" roughness={0.18} transmission={0.3} thickness={0.5} />
        </mesh>
      </group>
      <mesh position={[0.35, -1.72, -0.6]} receiveShadow>
        <cylinderGeometry args={[2.4, 2.8, 0.42, 40]} />
        <meshStandardMaterial color="#e4d5e7" roughness={0.82} />
      </mesh>
      <ContactShadows position={[0.35, -1.53, 0]} opacity={0.28} scale={6.8} blur={2.6} far={4} resolution={256} frames={1} />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={3.5} position={[4, 4, 3]} scale={[4, 4, 1]} />
        <Lightformer form="rect" intensity={2} position={[-4, 1, 2]} scale={[3, 5, 1]} />
        <Lightformer form="ring" intensity={1.5} position={[0, 4, -4]} scale={4} />
      </Environment>
    </>
  )
}

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2'))
  } catch {
    return false
  }
}

export function HeroCanvas({ active = true }: { active?: boolean }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    setReady(!reduced && !connection?.saveData && canUseWebGL())
  }, [])

  if (!ready) return <div className="three-poster" aria-hidden="true" />

  return (
    <Canvas
      shadows
      frameloop={active ? 'always' : 'demand'}
      dpr={[1, 1.5]}
      camera={{ fov: 29, position: [0, 0.08, 7.8], near: 0.1, far: 40 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', stencil: false }}
      fallback={<div className="three-poster" aria-hidden="true" />}
    >
      <Suspense fallback={null}>
        <HeroComposition />
      </Suspense>
    </Canvas>
  )
}
