'use client'

import styles from './player.module.css'
interface PairingViewProps {
  code: string
}

export default function PairingView({ code }: PairingViewProps) {
  return (
    <div className={styles.shell} style={{ width: '100%', height: '100%' }}>
      <div className={styles.pairingView}>
        <div className={styles.brand}>
          Nu<span>Exis</span>
        </div>

        <p className={styles.instructionLabel}>Pairing Code</p>

        <div className={styles.codeDisplay}>
          <div className={styles.codeDigitSingle}>{code}</div>
        </div>

        <div className={styles.howTo}>
          <p className={styles.howToTitle}>
            Enter this code in your NuExis dashboard to pair this screen.
          </p>
          <span className={styles.howToPath}>
            Dashboard → Screens → Add Screen
          </span>
        </div>
      </div>
    </div>
  )
}
