import React from 'react'
import { Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { colors, fonts, fontSize } from '@/src/ui/theme'

type Variant = 'display' | 'title' | 'body' | 'label' | 'numeric'

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, color: colors.text },
  title: { fontFamily: fonts.uiSemiBold, fontSize: fontSize.lg, color: colors.text },
  body: { fontFamily: fonts.ui, fontSize: fontSize.md, color: colors.text },
  label: { fontFamily: fonts.uiMedium, fontSize: fontSize.sm, color: colors.muted },
  numeric: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.text, fontVariant: ['tabular-nums'] },
}

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText style={[VARIANT_STYLE[variant], style]} {...rest} />
}
