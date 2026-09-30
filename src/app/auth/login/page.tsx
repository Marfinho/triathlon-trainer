"use client";

import AuthFrame from "@/components/marketing/AuthFrame";
import LoginForm from "@/components/marketing/LoginForm";

export default function LoginPage() {
  return (
    <AuthFrame emoji="👋" title="Willkommen zurück" subtitle="Schön, dass du da bist. Weiter geht’s mit deinem Training.">
      <LoginForm />
    </AuthFrame>
  );
}
