import React from 'react'
import { StyleSheet, View, type ViewProps } from 'react-native'
import { colors, radius, space } from '@/src/ui/theme'

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'ghost' | 'accent'
}

export function Card({ style, children, variant = 'default', ...rest }: CardProps) {
  return (
    <View style={[styles.base, styles[variant], style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    padding: space.lg,
  },
  default: {
    backgroundColor: colors.bg1,
    borderWidth: 1,
    borderColor: colors.line,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    // Android elevation
    elevation: 3,
  },
  elevated: {
    backgroundColor: colors.bg1,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  ghost: {
    backgroundColor: colors.bg2,
    borderWidth: 0,
  },
  accent: {
    backgroundColor: colors.bg1,
    borderWidth: 1,
    borderColor: colors.brand,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
})
