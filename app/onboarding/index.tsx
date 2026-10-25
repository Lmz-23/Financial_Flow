import { Redirect } from 'expo-router';

import { routes } from '../../src/navigation/routes';

/** Entrada a /onboarding: lleva al paso 1. */
export default function OnboardingIndex() {
  return <Redirect href={routes.onboardingAccounts()} />;
}
