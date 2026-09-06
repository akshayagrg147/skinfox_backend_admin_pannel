import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import * as THREE from 'three'
import { getProductById } from '../../data/products'
import { ProductModel } from './ProductModel'

const ritualProducts = [
  getProductById('onion-shampoo'),
  getProductById('onion-hair-oil'),
  getProductById('intensive-scalp-hair-treatment'),
  getProductById('hydrelle-dry-skin-specialist'),
]

function RitualComposition({ active }: { active: number }) {
  const refs = useRef<Array<THREE.Group | null>>([])

  useFrame(({ clock }, delta) => {
    refs.current.forEach((item, index) => {
      if (!item) return
      const selected = index === active
      const targetY = selected ? 0.3 : -0.18
      item.position.y = THREE.MathUtils.damp(item.position.y, targetY + Math.sin(clock.elapsedTime * 0.6 + index) * 0.025, 6, delta)
      item.rotation.y = THREE.MathUtils.damp(item.rotation.y, selected ? -0.12 : 0.08 * (index - 1.5), 6, delta)
      item.scale.setScalar(THREE.MathUtils.damp(item.scale.x, selected ? 0.9 : 0.72, 6, delta))
    })
  })

  return (
    <>
      <group position={[0, -0.25, 0]}>
        {ritualProducts.map((product, index) => (
          <group
            key={product.id}
            ref={(node) => {
              refs.current[index] = node
            }}
            position={[(index - 1.5) * 1.45, -0.18, index === active ? 0.45 : -0.15]}
            scale={0.72}
          >
            <ProductModel product={product} />
          </group>
        ))}
      </group>
      <mesh position={[0, -1.72, -0.45]} receiveShadow>
        <boxGeometry args={[6.3, 0.24, 1.85]} />
        <meshStandardMaterial color="#cbb8d2" roughness={0.9} />
      </mesh>
      <ContactShadows position={[0, -1.55, 0]} opacity={0.25} scale={8} blur={2.8} far={4} resolution={256} frames={1} />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={4} position={[4, 5, 4]} scale={[4, 5, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-4, 1, 2]} scale={[3, 4, 1]} />
      </Environment>
    </>
  )
}

export function RitualCanvas({ active, visible = true }: { active: number; visible?: boolean }) {
  return (
    <Canvas
      frameloop={visible ? 'always' : 'demand'}
      dpr={[1, 1.35]}
      camera={{ fov: 29, position: [0, 0.2, 8], near: 0.1, far: 40 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', stencil: false }}
    >
      <Suspense fallback={null}>
        <RitualComposition active={active} />
      </Suspense>
    </Canvas>
  )
}
