import {createSignal, onMount} from 'solid-js';
import Section from '@components/section';
import Row from '@components/rowTsx';
import CheckboxFieldTsx from '@components/checkboxFieldTsx';
import {useSuperTab} from '@components/solidJsTabs/superTabProvider';
import {isBlockSponsored, setBlockSponsored} from '@helpers/sponsoredMessages';

export default function AdvancedSettings() {
  const [tab] = useSuperTab();

  const [blockAdsChecked, setBlockAdsChecked] = createSignal(isBlockSponsored());

  const onToggleBlockAds = (checked: boolean) => {
    setBlockAdsChecked(checked);
    setBlockSponsored(checked);
  };

  onMount(() => {
    tab.header.classList.add('with-border');
  });

  return (
    <Section name={<span>高级设置</span>}>
      <Row>
        <Row.CheckboxFieldToggle>
          <CheckboxFieldTsx
            toggle
            checked={blockAdsChecked()}
            onChange={onToggleBlockAds}
          />
        </Row.CheckboxFieldToggle>
        <Row.Title>屏蔽广告消息</Row.Title>
      </Row>
    </Section>
  );
}