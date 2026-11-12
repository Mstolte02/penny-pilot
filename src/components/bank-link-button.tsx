import { PillButton } from '@/components/penny-ui';

const NATIVE_ONLY =
  "Plaid Link works in iOS and Android development builds. Expo Go and web can't load the native Plaid module.";

type BankLinkButtonProps = {
  onStatusChange?: (message: string) => void;
  onConnected?: () => void;
};

export function BankLinkButton({ onStatusChange }: BankLinkButtonProps) {
  return (
    <PillButton tone="primary" onPress={() => onStatusChange?.(NATIVE_ONLY)}>
      Connect bank
    </PillButton>
  );
}

type ReconnectBankButtonProps = {
  institutionId: string;
  institutionName: string;
  onStatusChange?: (message: string) => void;
  onDone?: () => void;
};

export function ReconnectBankButton({ onStatusChange }: ReconnectBankButtonProps) {
  return (
    <PillButton tone="primary" onPress={() => onStatusChange?.(NATIVE_ONLY)}>
      Reconnect
    </PillButton>
  );
}
