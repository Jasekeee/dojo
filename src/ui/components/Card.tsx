// Matte surface cards — depth via FILL difference, not borders.
// Hairline borders only (6% white). No colored glows.
import React from 'react'
import { StyleSheet, View, type ViewProps } from 'react-native'
import { colors, radius, space } from '@/src/ui/theme'

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'ghost' | 'hero'
  // Hairline champagne top edge for hero elements
  champagneEdge?: boolean
}

export function Card({
  style,
  children,
  variant = 'default',
  champagneEdge,
  ...rest
}: CardProps) {
  return (
    <View style={[styles.base, styles[variant], style]} {...rest}>
      {(champagneEdge || variant === 'hero') && (
        <View style={styles.champagneEdge} pointerEvents="none" />
      )}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    padding: space.xxl,
    overflow: 'hidden',
  },

  default: {
    backgroundColor: colors.bg1,
    borderWidth: 1,
    borderColor: colors.line,
  },

  elevated: {
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  ghost: {
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
  },

  // Hero: deepest surface, champagne hairline border
  hero: {
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.lineChampagneSoft,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },

  champagneEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.lineChampagne,
  },
})
