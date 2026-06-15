/**
 * Reusable auth form card with email/password + Google button.
 * Renders a glass card containing the form, the brand mark above it,
 * and a footer link to switch between sign-in and sign-up.
 */
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";

import { GlassCard, GradientBackground, GradientButton, GradientText } from "@/components/glass";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";

interface AuthFormProps {
  title: string;
  subtitle?: string;
  cta: string;
  loading?: boolean;
  onSubmit: () => void;
  footerText: string;
  footerCta: string;
  onFooterPress: () => void;
  googleLabel: string;
  onGoogle: () => void;
  children?: ReactNode;
  style?: ViewStyle;
}

export function AuthForm({
  title,
  subtitle,
  cta,
  loading,
  onSubmit,
  footerText,
  footerCta,
  onFooterPress,
  googleLabel,
  onGoogle,
  children,
  style,
}: AuthFormProps) {
  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <LinearGradient
              colors={Gradients.hero as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoMark}
            >
              <Text style={styles.logoText}>M</Text>
            </LinearGradient>
            <GradientText
              text="MyFeed"
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              style={Typography.h1}
            />
          </View>

          <View style={styles.headerBlock}>
            <Text style={[Typography.h2, { color: Colors.text, textAlign: "center" }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[
                  Typography.body,
                  { color: Colors.textMuted, textAlign: "center", marginTop: Spacing[2] },
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          <GlassCard padding={6} radius="2xl" style={styles.card}>
            {children}
            <View style={{ height: Spacing[4] }} />
            <GradientButton
              label={cta}
              onPress={onSubmit}
              loading={loading}
              variant="primary"
            />
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={[Typography.caption, { color: Colors.textSubtle }]}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <GradientButton
              label={googleLabel}
              onPress={onGoogle}
              variant="ghost"
              icon={<Text style={{ fontSize: 18 }}>G</Text>}
            />
          </GlassCard>

          <View style={styles.footer}>
            <Text style={[Typography.body, { color: Colors.textMuted }]}>{footerText} </Text>
            <TouchableOpacity onPress={onFooterPress}>
              <Text style={[Typography.bodyBold, { color: Colors.pink }]}>{footerCta}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

export function AuthField(
  props: TextInputProps & { label: string; error?: string },
) {
  const { label, error, style, ...rest } = props;
  return (
    <View style={{ marginBottom: Spacing[4] }}>
      <Text style={[Typography.smallBold, { color: Colors.textMuted, marginBottom: Spacing[2] }]}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={Colors.textSubtle}
        {...rest}
        style={[
          styles.input,
          error ? { borderColor: Colors.danger } : null,
          style,
        ]}
      />
      {error ? (
        <Text
          style={[
            Typography.caption,
            { color: Colors.danger, marginTop: Spacing[1] },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[12],
    paddingBottom: Spacing[10],
    justifyContent: "center",
  },
  brand: {
    alignItems: "center",
    gap: Spacing[3],
    marginBottom: Spacing[8],
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: Radius["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
  },
  headerBlock: { marginBottom: Spacing[6] },
  card: {},
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    marginVertical: Spacing[5],
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing[6],
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 16,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
  },
});
