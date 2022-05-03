import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Connector, useConnect } from 'wagmi';
import { isIOS } from '../../utils/isMobile';
import {
  useWalletConnectors,
  WalletConnector,
} from '../../wallets/useWalletConnectors';
import { MoreWallets } from '../../wallets/walletConnectors/more/more';
import { AsyncImage } from '../AsyncImage/AsyncImage';
import { Box } from '../Box/Box';
import { ActionButton } from '../Button/ActionButton';
import { CloseButton } from '../CloseButton/CloseButton';
import { BackIcon } from '../Icons/Back';
import { SpinnerIcon } from '../Icons/Spinner';
import { AppContext } from '../RainbowKitProvider/AppContext';
import {
  Chain,
  useRainbowKitChains,
} from '../RainbowKitProvider/RainbowKitChainContext';
import { useCoolMode } from '../RainbowKitProvider/useCoolMode';
import { Text } from '../Text/Text';
import * as styles from './MobileOptions.css';

const parseAndStoreWallets: (
  data: any,
  wallets: WalletConnector[],
  setOtherWallets: (otherWallets: WalletConnector[]) => void,
  connect: (connector: Connector) => Promise<any>,
  chains: Chain[]
) => void = (data, wallets, setOtherWallets, connect, chains) => {
  const defaultWalletNames = wallets.map(w => w.name);
  if (data?.listings) {
    const rawWallets: any[] = Object.values(data.listings);
    const cleanWallets: WalletConnector[] = rawWallets
      .filter(raw => raw.mobile.universal || raw.mobile.native) // filter out wallets we can't connect to
      .map(raw => {
        const MoreWalletsConnector = MoreWallets({
          chains,
          wcUrl: raw.mobile.universal || `${raw.mobile.native}/`,
        });
        return {
          ...MoreWalletsConnector,
          connect: () => connect(MoreWalletsConnector?.connector),
          groupName: 'more',
          iconBackground: 'transparent',
          iconUrl: raw.image_url.md,
          id: raw.id,
          name: raw.name,
          ready: true,
          recent: false,
          shortName: raw.metadata.shortName,
        };
      })
      .filter(w => !defaultWalletNames.includes(w.name));
    setOtherWallets(cleanWallets);
  }
};

function WalletButton({ wallet }: { wallet: WalletConnector }) {
  const {
    connect,
    iconBackground,
    iconUrl,
    id,
    mobile,
    name,
    onConnecting,
    ready,
    shortName,
  } = wallet;
  const getMobileUri = mobile?.getUri;
  const coolModeRef = useCoolMode(iconUrl);
  return (
    <Box
      as="button"
      color={ready ? 'modalText' : 'modalTextSecondary'}
      disabled={!ready}
      fontFamily="body"
      key={id}
      onClick={useCallback(async () => {
        connect?.();

        onConnecting?.(async () => {
          if (getMobileUri) {
            window.location.href = await getMobileUri();
          }
        });
      }, [connect, getMobileUri, onConnecting])}
      ref={coolModeRef}
      style={{ overflow: 'visible', textAlign: 'center' }}
      type="button"
      width="full"
    >
      <Box
        alignItems="center"
        display="flex"
        flexDirection="column"
        justifyContent="center"
      >
        <Box paddingBottom="8" paddingTop="10">
          <AsyncImage
            background={iconBackground}
            borderRadius="13"
            boxShadow="walletLogo"
            height="60"
            src={iconUrl}
            width="60"
          />
        </Box>
        <Box display="flex" flexDirection="column" gap="1" textAlign="center">
          <Text
            as="h2"
            color={wallet.ready ? 'modalText' : 'modalTextSecondary'}
            size="13"
            weight="medium"
          >
            {/* Fix button text clipping in Safari: https://stackoverflow.com/questions/41100273/overflowing-button-text-is-being-clipped-in-safari */}
            <Box as="span" position="relative">
              {shortName ?? name}
              {!wallet.ready && ' (unsupported)'}
            </Box>
          </Text>

          {wallet.recent && (
            <Text color="accentColor" size="12" weight="medium">
              Recent
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function OtherWalletsButton({
  action,
  wallets,
}: {
  action: () => void;
  wallets: {
    iconBackground: string;
    iconUrl: string | (() => Promise<string>);
  }[];
}) {
  const loadingWallets = !wallets?.length;
  return (
    <Box
      as="button"
      color="modalText"
      fontFamily="body"
      key="other-wallets"
      {...(!loadingWallets ? { onClick: action } : {})}
      style={{ overflow: 'visible', textAlign: 'center' }}
      type="button"
      width="full"
    >
      <Box
        alignItems="center"
        display="flex"
        flexDirection="column"
        justifyContent="center"
      >
        <Box paddingBottom="8" paddingTop="10">
          <Box
            alignItems="center"
            color="generalBorder"
            display="flex"
            flexDirection="row"
            gap="4"
            height="60"
            justifyContent="center"
            style={{ flexWrap: 'wrap' }}
            width="60"
            {...(loadingWallets
              ? { background: 'generalBorderDim', borderRadius: '6' }
              : {})}
          >
            {loadingWallets && <SpinnerIcon />}
            {wallets.map((w, i) => (
              <AsyncImage
                background={w.iconBackground}
                borderRadius="6"
                boxShadow="walletLogo"
                height="28"
                key={i}
                src={w.iconUrl}
                width="28"
              />
            ))}
          </Box>
        </Box>
        <Box display="flex" flexDirection="column" gap="1" textAlign="center">
          <Text as="h2" color="modalText" size="13" weight="medium">
            {/* Fix button text clipping in Safari: https://stackoverflow.com/questions/41100273/overflowing-button-text-is-being-clipped-in-safari */}
            <Box as="span" position="relative">
              More ↓
            </Box>
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

enum MobileWalletStep {
  Connect = 'CONNECT',
  Get = 'GET',
}

export function MobileOptions({ onClose }: { onClose: () => void }) {
  const titleId = 'rk_connect_title';
  const wallets = useWalletConnectors();
  const { learnMoreUrl } = useContext(AppContext);
  const { connectAsync } = useConnect();
  const chains = useRainbowKitChains();

  let headerLabel = null;
  let walletContent = null;
  let headerBackgroundContrast = false;
  let headerBackButtonLink: MobileWalletStep | null = null;

  const [walletStep, setWalletStep] = useState<MobileWalletStep>(
    MobileWalletStep.Connect
  );

  const [showOtherWallets, setShowOtherWallets] = useState<boolean>(false);
  const [otherWallets, setOtherWallets] = useState<WalletConnector[]>([]);

  useEffect(() => {
    const fetchOtherWallets = async () => {
      const res = await fetch(
        'https://registry.walletconnect.com/api/v2/wallets'
      );
      const resJson = await res.json();
      parseAndStoreWallets(
        resJson,
        wallets,
        setOtherWallets,
        connectAsync,
        chains as Chain[]
      );
    };
    fetchOtherWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ios = isIOS();

  switch (walletStep) {
    case MobileWalletStep.Connect: {
      headerLabel = 'Connect a Wallet';
      headerBackgroundContrast = true;
      walletContent = (
        <>
          <Box
            background="profileForeground"
            className={styles.walletsContainer}
            display="flex"
            justifyContent="center"
            paddingBottom="20"
            paddingTop="6"
          >
            {[...wallets, ...(showOtherWallets ? otherWallets : [])]
              .filter(wallet => wallet.ready)
              .map(wallet => {
                return (
                  <Box key={wallet.id} paddingX="14">
                    <Box width="60">
                      <WalletButton wallet={wallet} />
                    </Box>
                  </Box>
                );
              })}
            {!showOtherWallets && (
              <Box key="more-wallets" paddingX="14">
                <Box height="60" width="60">
                  <OtherWalletsButton
                    action={() => setShowOtherWallets(true)}
                    wallets={otherWallets.slice(0, 4).map(w => ({
                      iconBackground: w.iconBackground,
                      iconUrl: w.iconUrl,
                    }))}
                  />
                </Box>
              </Box>
            )}
            {showOtherWallets && (
              <Box display="flex" justifyContent="center" width="full">
                <ActionButton
                  label="Show Less"
                  onClick={() => setShowOtherWallets(false)}
                  size="large"
                  stretch
                  type="secondary"
                />
              </Box>
            )}
          </Box>

          <Box
            background="generalBorder"
            height="1"
            marginBottom="32"
            marginTop="-1"
          />

          <Box
            alignItems="center"
            display="flex"
            flexDirection="column"
            gap="32"
            paddingX="32"
            style={{ textAlign: 'center' }}
          >
            <Box
              display="flex"
              flexDirection="column"
              gap="8"
              textAlign="center"
            >
              <Text color="modalText" size="16" weight="bold">
                What is a Wallet?
              </Text>
              <Text color="modalTextSecondary" size="16">
                A wallet is used to send, receive, store, and display digital
                assets. It&rsquo;s also a new way to log in, without needing to
                create new accounts and passwords on&nbsp;every&nbsp;website.
              </Text>
            </Box>
          </Box>

          <Box paddingTop="32" paddingX="20">
            <Box display="flex" gap="14" justifyContent="center">
              <ActionButton
                label="Get a Wallet"
                onClick={() => setWalletStep(MobileWalletStep.Get)}
                size="large"
                type="secondary"
              />
              <ActionButton
                href={learnMoreUrl}
                label="Learn More"
                size="large"
                type="secondary"
              />
            </Box>
          </Box>
        </>
      );
      break;
    }
    case MobileWalletStep.Get: {
      headerLabel = 'Get a Wallet';
      headerBackButtonLink = MobileWalletStep.Connect;

      const mobileWallets = wallets
        ?.filter(
          wallet => wallet.downloadUrls?.ios || wallet.downloadUrls?.android
        )
        ?.splice(0, 3);

      walletContent = (
        <>
          <Box
            alignItems="center"
            display="flex"
            flexDirection="column"
            height="full"
            marginBottom="36"
            marginTop="5"
            paddingTop="12"
            width="full"
          >
            {mobileWallets.map((wallet, index) => {
              const { downloadUrls, iconBackground, iconUrl, name } = wallet;

              if (!downloadUrls?.ios && !downloadUrls?.android) {
                return null;
              }

              return (
                <Box
                  display="flex"
                  gap="16"
                  key={wallet.id}
                  paddingX="20"
                  width="full"
                >
                  <Box style={{ minHeight: 48, minWidth: 48 }}>
                    <AsyncImage
                      background={iconBackground}
                      borderColor="generalBorder"
                      borderRadius="10"
                      height="48"
                      src={iconUrl}
                      width="48"
                    />
                  </Box>
                  <Box display="flex" flexDirection="column" width="full">
                    <Box alignItems="center" display="flex" height="48">
                      <Box width="full">
                        <Text color="modalText" size="18" weight="bold">
                          {name}
                        </Text>
                      </Box>
                      <ActionButton
                        href={ios ? downloadUrls?.ios : downloadUrls?.android}
                        label="GET"
                        size="small"
                        type="secondary"
                      />
                    </Box>
                    {index < mobileWallets.length - 1 && (
                      <Box
                        background="generalBorderDim"
                        height="1"
                        marginY="10"
                        width="full"
                      />
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
          {/* spacer */}
          <Box style={{ marginBottom: '42px' }} />
          <Box
            alignItems="center"
            display="flex"
            flexDirection="column"
            gap="36"
            paddingX="36"
            style={{ textAlign: 'center' }}
          >
            <Box
              display="flex"
              flexDirection="column"
              gap="12"
              textAlign="center"
            >
              <Text color="modalText" size="16" weight="bold">
                Not what you&rsquo;re looking for?
              </Text>
              <Text color="modalTextSecondary" size="16">
                Select a wallet on the main screen to get started with a
                different wallet provider.
              </Text>
            </Box>
          </Box>
        </>
      );
      break;
    }
  }

  return (
    <Box display="flex" flexDirection="column" paddingBottom="36">
      {/* header section */}
      <Box
        background={
          headerBackgroundContrast ? 'profileForeground' : 'modalBackground'
        }
        display="flex"
        flexDirection="column"
        paddingBottom="4"
        paddingTop="14"
      >
        <Box
          display="flex"
          justifyContent="center"
          paddingBottom="6"
          paddingX="20"
          position="relative"
        >
          {headerBackButtonLink && (
            <Box
              display="flex"
              position="absolute"
              style={{
                left: 0,
                marginBottom: -20,
                marginTop: -20,
              }}
            >
              <Box
                alignItems="center"
                as="button"
                color="accentColor"
                display="flex"
                marginLeft="4"
                marginTop="20"
                onClick={() => setWalletStep(headerBackButtonLink!)}
                padding="16"
                style={{ height: 17, willChange: 'transform' }}
                transform={{ active: 'shrinkSm', hover: 'growLg' }}
                transition="default"
              >
                <BackIcon />
              </Box>
            </Box>
          )}

          <Box marginTop="4" textAlign="center" width="full">
            <Text
              as="h1"
              color="modalText"
              id={titleId}
              size="20"
              weight="bold"
            >
              {headerLabel}
            </Text>
          </Box>

          <Box
            alignItems="center"
            display="flex"
            height="32"
            paddingRight="14"
            position="absolute"
            right="0"
          >
            <Box
              style={{ marginBottom: -20, marginTop: -20 }} // Vertical bleed
            >
              <CloseButton onClose={onClose} />
            </Box>
          </Box>
        </Box>
      </Box>
      <Box display="flex" flexDirection="column">
        {walletContent}
      </Box>
    </Box>
  );
}
