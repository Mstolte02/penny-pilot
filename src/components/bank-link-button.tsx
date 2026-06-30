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
          'Plaid Link is ready for iOS/Android development builds. Expo Go and web do not load the native Plaid module.'
        )
      }>
      Connect bank
    </PillButton>
  );
}
