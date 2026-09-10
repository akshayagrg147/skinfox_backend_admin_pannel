import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import { SiteRouter } from './seo/SiteRouter'
import './styles.css'
import './storefront-polish.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user"><SiteRouter /></MotionConfig>
  </React.StrictMode>,
)
