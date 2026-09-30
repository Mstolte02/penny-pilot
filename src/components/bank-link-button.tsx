import { PillButton } from '@/components/penny-ui';

type BankLinkButtonProps = {
  onStatusChange?: (message: string) => void;
};

export function BankLinkButton({ onStatusChange }: BankLinkButtonProps) {
  return (
    <PillButton
      tone="primary"
      onPress={() =>
        onStatusChange?.(
          "Plaid Link works in iOS and Android development builds. Expo Go and web can't load the native Plaid module."
        )
      }>
      Connect bank
    </PillButton>
  );
}
