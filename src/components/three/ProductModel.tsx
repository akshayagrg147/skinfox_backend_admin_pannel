import { RoundedBox } from '@react-three/drei'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import type { Product } from '../../types'

type ProductModelProps = {
  product: Product
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

const shampooProfile = [
  new THREE.Vector2(0, -1.2),
  new THREE.Vector2(0.52, -1.2),
  new THREE.Vector2(0.57, -1.08),
  new THREE.Vector2(0.57, 0.72),
  new THREE.Vector2(0.53, 0.9),
  new THREE.Vector2(0.44, 1.04),
  new THREE.Vector2(0.29, 1.15),
  new THREE.Vector2(0.27, 1.34),
]

const treatmentProfile = [
  new THREE.Vector2(0, -1.25),
  new THREE.Vector2(0.48, -1.25),
  new THREE.Vector2(0.52, -1.13),
  new THREE.Vector2(0.52, 0.72),
  new THREE.Vector2(0.49, 0.9),
  new THREE.Vector2(0.4, 1.06),
  new THREE.Vector2(0.28, 1.16),
  new THREE.Vector2(0.27, 1.38),
]

function LabelPanel({
  product,
  y = 0,
  z = 0.42,
  width = 0.76,
  height = 1.08,
  panelColor = product.tint,
  inkColor = product.accent,
  lowerColor,
}: {
  product: Product
  y?: number
  z?: number
  width?: number
  height?: number
  panelColor?: string
  inkColor?: string
  lowerColor?: string
}) {
  return (
    <group position={[0, y, z]}>
      <mesh>
        <boxGeometry args={[width, height, 0.028]} />
        <meshStandardMaterial color={panelColor} roughness={0.76} />
      </mesh>
      <mesh position={[0, height * 0.2, 0.02]}>
        <boxGeometry args={[width * 0.45, 0.027, 0.012]} />
        <meshStandardMaterial color={inkColor} roughness={0.6} />
      </mesh>
      <mesh position={[0, -height * 0.05, 0.021]}>
        <circleGeometry args={[Math.min(width, height) * 0.075, 3]} />
        <meshStandardMaterial color={inkColor} roughness={0.6} />
      </mesh>
      <mesh position={[0, -height * 0.27, 0.02]}>
        <boxGeometry args={[width * 0.58, 0.018, 0.012]} />
        <meshStandardMaterial color={inkColor} transparent opacity={0.48} />
      </mesh>
      {lowerColor && (
        <mesh position={[0, -height * 0.36, 0.022]}>
          <boxGeometry args={[width, height * 0.22, 0.014]} />
          <meshStandardMaterial color={lowerColor} roughness={0.7} />
        </mesh>
      )}
    </group>
  )
}

function PumpBottle({ product }: { product: Product }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[shampooProfile, 36]} />
        <meshPhysicalMaterial color={product.color} roughness={0.16} clearcoat={0.95} clearcoatRoughness={0.1} />
      </mesh>
      <mesh position={[0, 1.48, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.3, 32]} />
        <meshStandardMaterial color="#151312" roughness={0.3} />
      </mesh>
      <group position={[0, 1.78, 0]}>
        <mesh>
          <cylinderGeometry args={[0.15, 0.19, 0.34, 32]} />
          <meshStandardMaterial color="#151312" roughness={0.28} />
        </mesh>
        <mesh position={[0.17, 0.13, 0]}>
          <boxGeometry args={[0.5, 0.11, 0.2]} />
          <meshStandardMaterial color="#151312" roughness={0.28} />
        </mesh>
      </group>
      <LabelPanel product={product} y={0.05} z={0.56} width={0.86} height={1.42} panelColor="#f6ebec" inkColor="#582477" lowerColor="#d65b91" />
    </group>
  )
}

function SqueezeTube({ product }: { product: Product }) {
  const width = 1.22
  const height = 2.48
  const depth = 0.6

  return (
    <group>
      <RoundedBox args={[width, height, depth]} radius={0.24} smoothness={4} castShadow receiveShadow>
        <meshPhysicalMaterial color={product.color} roughness={0.4} clearcoat={0.24} clearcoatRoughness={0.28} />
      </RoundedBox>
      <mesh position={[0, height / 2 + 0.04, 0]} castShadow>
        <boxGeometry args={[width * 0.9, 0.11, depth * 0.98]} />
        <meshStandardMaterial color="#f2f0ea" roughness={0.52} />
      </mesh>
      <RoundedBox args={[width * 0.68, 0.34, depth * 1.02]} radius={0.08} smoothness={3} position={[0, -height / 2 - 0.18, 0]} castShadow>
        <meshStandardMaterial color="#f3efe8" roughness={0.38} />
      </RoundedBox>
      <group position={[0, 0.22, depth / 2 + 0.03]}>
        <mesh position={[-0.18, 0.2, 0]}>
          <circleGeometry args={[0.31, 32]} />
          <meshStandardMaterial color="#f4f1eb" roughness={0.75} />
        </mesh>
        <mesh position={[0.18, 0.2, 0]}>
          <circleGeometry args={[0.31, 32]} />
          <meshStandardMaterial color="#f4f1eb" roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.16, 0]} rotation={[0, 0, Math.PI]}>
          <circleGeometry args={[0.54, 3]} />
          <meshStandardMaterial color="#f4f1eb" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.1, 0.02]}>
          <boxGeometry args={[0.42, 0.026, 0.012]} />
          <meshStandardMaterial color={product.color} />
        </mesh>
      </group>
    </group>
  )
}

function OilBottle({ product }: { product: Product }) {
  return (
    <group>
      <RoundedBox args={[1.08, 2.62, 0.67]} radius={0.12} smoothness={4} castShadow receiveShadow>
        <meshPhysicalMaterial color={product.color} roughness={0.17} clearcoat={1} clearcoatRoughness={0.1} />
      </RoundedBox>
      <mesh position={[0, 1.49, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.3, 0.28, 32]} />
        <meshStandardMaterial color={product.color} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.82, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.48, 32]} />
        <meshStandardMaterial color={product.accent} metalness={0.72} roughness={0.2} />
      </mesh>
      <LabelPanel product={product} y={0.16} z={0.36} width={0.78} height={1.76} panelColor="#f7f2ed" inkColor="#4b2869" />
      <mesh position={[0, -0.58, 0.385]}>
        <boxGeometry args={[0.78, 0.42, 0.03]} />
        <meshStandardMaterial color="#58316f" roughness={0.72} />
      </mesh>
    </group>
  )
}

function TreatmentBottle({ product }: { product: Product }) {
  const herbs = [
    [-0.22, -0.72, 0.12, -0.28],
    [0.17, -0.5, 0.18, 0.24],
    [-0.08, -0.15, 0.08, -0.1],
    [0.22, 0.18, 0.1, 0.32],
    [-0.2, 0.35, 0.02, -0.22],
    [0.05, 0.62, 0.08, 0.15],
  ] as const

  return (
    <group>
      <mesh position={[0, -0.14, 0]}>
        <cylinderGeometry args={[0.43, 0.45, 2.05, 32]} />
        <meshStandardMaterial color="#b77818" transparent opacity={0.72} />
      </mesh>
      {herbs.map(([x, y, z, rotation], index) => (
        <group key={`${x}-${y}`} position={[x, y, z]} rotation={[0, 0, rotation]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.018, 0.58, 6]} />
            <meshStandardMaterial color={index % 2 ? '#75602a' : '#59361e'} roughness={0.9} />
          </mesh>
          <mesh position={[0.09, 0.08, 0]} rotation={[0, 0, -0.7]} scale={[1.5, 0.55, 0.7]}>
            <sphereGeometry args={[0.08, 8, 6]} />
            <meshStandardMaterial color={index % 3 ? '#75602a' : '#793f38'} roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh castShadow receiveShadow>
        <latheGeometry args={[treatmentProfile, 36]} />
        <meshPhysicalMaterial color="#ead7a1" roughness={0.08} clearcoat={1} clearcoatRoughness={0.06} transmission={0.42} thickness={0.18} ior={1.42} transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.58, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.46, 32]} />
        <meshStandardMaterial color={product.accent} metalness={0.68} roughness={0.22} />
      </mesh>
      <mesh position={[0, 1.37, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.33, 0.025, 8, 32]} />
        <meshStandardMaterial color="#b9872d" metalness={0.6} roughness={0.25} />
      </mesh>
      <LabelPanel product={product} y={0.05} z={0.52} width={0.55} height={1.38} panelColor="#f7f2e7" inkColor="#4a3028" />
    </group>
  )
}

export function ProductModel({ product, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: ProductModelProps) {
  let model: ReactNode
  switch (product.packaging) {
    case 'pump-bottle':
      model = <PumpBottle product={product} />
      break
    case 'tube':
      model = <SqueezeTube product={product} />
      break
    case 'oil-bottle':
      model = <OilBottle product={product} />
      break
    case 'treatment-bottle':
      model = <TreatmentBottle product={product} />
      break
  }

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {model}
    </group>
  )
}
