import {createEffect, createSignal, onMount} from 'solid-js';
import Section from '@components/section';
import Row from '@components/rowTsx';
import CheckboxFieldTsx from '@components/checkboxFieldTsx';
import {useSuperTab} from '@components/solidJsTabs/superTabProvider';
import {isBlockSponsored, setBlockSponsored} from '@helpers/sponsoredMessages';
import {
  isBlockPinned, setBlockPinned,
  getMessageKeywords, setMessageKeywords,
  getUserKeywords, setUserKeywords,
  refreshContentFilter
} from '@helpers/contentFilter';

export default function AdvancedSettings() {
  const [tab] = useSuperTab();

  const [blockAdsChecked, setBlockAdsChecked] = createSignal(isBlockSponsored());
  const [blockPinnedChecked, setBlockPinnedChecked] = createSignal(isBlockPinned());
  const [msgKeywords, setMsgKeywords] = createSignal(getMessageKeywords().join(', '));
  const [userKeywords, setUserKeywords_] = createSignal(getUserKeywords().join(', '));

  const onToggleBlockAds = (checked: boolean) => {
    setBlockAdsChecked(checked);
    setBlockSponsored(checked);
  };

  const onToggleBlockPinned = (checked: boolean) => {
    setBlockPinnedChecked(checked);
    setBlockPinned(checked);
  };

  let msgKwTimeout: ReturnType<typeof setTimeout>;
  const onMsgKwInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    setMsgKeywords(val);
    clearTimeout(msgKwTimeout);
    msgKwTimeout = setTimeout(() => {
      setMessageKeywords(val);
      refreshContentFilter();
    }, 400);
  };

  let userKwTimeout: ReturnType<typeof setTimeout>;
  const onUserKwInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    setUserKeywords_(val);
    clearTimeout(userKwTimeout);
    userKwTimeout = setTimeout(() => {
      setUserKeywords(val);
      refreshContentFilter();
    }, 400);
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
      <Row>
        <Row.CheckboxFieldToggle>
          <CheckboxFieldTsx
            toggle
            checked={blockPinnedChecked()}
            onChange={onToggleBlockPinned}
          />
        </Row.CheckboxFieldToggle>
        <Row.Title>屏蔽置顶消息</Row.Title>
      </Row>
      <Section name={<span>消息关键字屏蔽</span>}>
        <div style="padding: 0 16px 8px;">
          <div style="color: var(--secondary-color); font-size: 13px; margin-bottom: 6px;">
            包含以下关键字的消息将被隐藏（逗号分隔）
          </div>
          <input
            type="text"
            value={msgKeywords()}
            onInput={onMsgKwInput}
            placeholder="例如: 广告, 推广, 抽奖"
            style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--surface-color); color: var(--primary-color); font-size: 14px; outline: none; box-sizing: border-box;"
          />
        </div>
      </Section>
      <Section name={<span>用户关键字屏蔽</span>}>
        <div style="padding: 0 16px 8px;">
          <div style="color: var(--secondary-color); font-size: 13px; margin-bottom: 6px;">
            来自用户名包含以下关键字的用户的消息将被隐藏（逗号分隔）
          </div>
          <input
            type="text"
            value={userKeywords()}
            onInput={onUserKwInput}
            placeholder="例如: 机器人, bot"
            style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--surface-color); color: var(--primary-color); font-size: 14px; outline: none; box-sizing: border-box;"
          />
        </div>
      </Section>
    </Section>
  );
}
