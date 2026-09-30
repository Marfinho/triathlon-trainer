"use client";

import AuthFrame from "@/components/marketing/AuthFrame";
import RegisterForm from "@/components/marketing/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthFrame
      emoji="🚀"
      title="Konto erstellen"
      subtitle="Alle deine Trainingsdaten an einem Ort — kostenlos starten."
    >
      <RegisterForm />
    </AuthFrame>
  );
}
