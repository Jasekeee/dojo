import React from 'react'
import { Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { colors, fonts, fontSize } from '@/src/ui/theme'

type Variant = 'display' | 'hero' | 'title' | 'body' | 'label' | 'caption' | 'numeric' | 'numericLarge'

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  hero: {
    fontFamily: fonts.displayBold,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.5,
    color: colors.text,
  },
  display: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xxl,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: colors.text,
  },
  title: {
    fontFamily: fonts.uiSemiBold,
    fontSize: fontSize.lg,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: fontSize.md,
    lineHeight: 24,
    letterSpacing: 0.1,
    color: colors.text,
  },
  label: {
    fontFamily: fonts.uiMedium,
    fontSize: fontSize.sm,
    lineHeight: 20,
    letterSpacing: 0.2,
    color: colors.muted,
  },
  caption: {
    fontFamily: fonts.ui,
    fontSize: fontSize.xs,
    lineHeight: 16,
    letterSpacing: 0.3,
    color: colors.muted,
  },
  numeric: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    lineHeight: 26,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  numericLarge: {
    fontFamily: fonts.displayBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
}

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText style={[VARIANT_STYLE[variant], style]} {...rest} />
}
