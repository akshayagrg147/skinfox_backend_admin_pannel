import { Environment, Lightformer, PresentationControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type { Product } from '../../types'
import { ProductModel } from './ProductModel'

export function ProductViewer({ product }: { product: Product }) {
  const scale = {
    'pump-bottle': 0.9,
    'oil-bottle': 0.92,
    tube: 1.02,
    'treatment-bottle': 0.92,
  }[product.packaging]

  return (
    <Canvas dpr={[1, 1.4]} camera={{ fov: 31, position: [0, 0.15, 6] }} gl={{ alpha: true, antialias: true }}>
      <PresentationControls
        global={false}
        cursor
        snap={{ mass: 1, tension: 180 }}
        speed={1.2}
        rotation={[0, -0.2, 0]}
        polar={[-0.16, 0.16]}
        azimuth={[-0.75, 0.75]}
      >
        <group position={[0, -0.48, 0]} scale={scale}>
          <ProductModel product={product} />
        </group>
      </PresentationControls>
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={4} position={[4, 4, 3]} scale={[4, 4, 1]} />
        <Lightformer form="rect" intensity={2} position={[-4, 1, 2]} scale={[3, 4, 1]} />
      </Environment>
    </Canvas>
  )
}
