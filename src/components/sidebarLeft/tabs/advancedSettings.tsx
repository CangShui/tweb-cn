import {createSignal, onMount} from 'solid-js';
import Section from '@components/section';
import Row from '@components/rowTsx';
import CheckboxFieldTsx from '@components/checkboxFieldTsx';
import {useSuperTab} from '@components/solidJsTabs/superTabProvider';
import {isBlockSponsored, setBlockSponsored} from '@helpers/sponsoredMessages';
import {
  isBlockImageAvatars,
  isClickToLoadStickers,
  setBlockImageAvatars,
  setClickToLoadStickers
} from '@helpers/mediaPrivacy';
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
  const [blockImageAvatarsChecked, setBlockImageAvatarsChecked] = createSignal(isBlockImageAvatars());
  const [clickToLoadStickersChecked, setClickToLoadStickersChecked] = createSignal(isClickToLoadStickers());
  const [msgKeywords, setMsgKeywords] = createSignal(getMessageKeywords().join('\n'));
  const [userKeywords, setUserKeywords_] = createSignal(getUserKeywords().join('\n'));

  const onToggleBlockAds = (checked: boolean) => {
    setBlockAdsChecked(checked);
    setBlockSponsored(checked);
  };

  const onToggleBlockPinned = (checked: boolean) => {
    setBlockPinnedChecked(checked);
    setBlockPinned(checked);
  };

  const onToggleBlockImageAvatars = (checked: boolean) => {
    setBlockImageAvatarsChecked(checked);
    setBlockImageAvatars(checked);
  };

  const onToggleClickToLoadStickers = (checked: boolean) => {
    setClickToLoadStickersChecked(checked);
    setClickToLoadStickers(checked);
  };

  let msgKwTimeout: ReturnType<typeof setTimeout>;
  const onMsgKwInput = (e: Event) => {
    const val = (e.target as HTMLTextAreaElement).value;
    setMsgKeywords(val);
    clearTimeout(msgKwTimeout);
    msgKwTimeout = setTimeout(() => {
      setMessageKeywords(val.replace(/\n/g, ','));
      refreshContentFilter();
    }, 400);
  };

  let userKwTimeout: ReturnType<typeof setTimeout>;
  const onUserKwInput = (e: Event) => {
    const val = (e.target as HTMLTextAreaElement).value;
    setUserKeywords_(val);
    clearTimeout(userKwTimeout);
    userKwTimeout = setTimeout(() => {
      setUserKeywords(val.replace(/\n/g, ','));
      refreshContentFilter();
    }, 400);
  };

  onMount(() => {
    tab.header.classList.add('with-border');
  });

  return (
    <>
      <Section name={<span>内容屏蔽</span>}>
        <div class="profile-buttons">
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
        </div>
      </Section>

      <Section name={<span>媒体隐私</span>}>
        <div class="profile-buttons">
          <Row>
            <Row.CheckboxFieldToggle>
              <CheckboxFieldTsx
                toggle
                checked={blockImageAvatarsChecked()}
                onChange={onToggleBlockImageAvatars}
              />
            </Row.CheckboxFieldToggle>
            <Row.Title>屏蔽图片头像</Row.Title>
            <Row.Subtitle>不下载头像图片，显示 Telegram 默认头像</Row.Subtitle>
          </Row>
          <Row>
            <Row.CheckboxFieldToggle>
              <CheckboxFieldTsx
                toggle
                checked={clickToLoadStickersChecked()}
                onChange={onToggleClickToLoadStickers}
              />
            </Row.CheckboxFieldToggle>
            <Row.Title>贴纸点击加载</Row.Title>
            <Row.Subtitle>聊天中的图片和动画贴纸仅在点击后下载</Row.Subtitle>
          </Row>
        </div>
      </Section>

      <Section name={<span>消息关键字屏蔽</span>}>
        <div style="padding: 0 0 4px;">
          <div style="color: var(--secondary-color); font-size: 13px; margin-bottom: 6px; padding: 0 16px;">
            包含以下关键字的消息将被隐藏（每行一个关键字）
          </div>
          <div style="padding: 0 16px;">
            <textarea
              class="content-filter-textarea"
              value={msgKeywords()}
              onInput={onMsgKwInput}
              placeholder={'广告\n推广\n抽奖\n福利\n红包'}
            />
          </div>
        </div>
      </Section>

      <Section name={<span>用户关键字屏蔽</span>}>
        <div style="padding: 0 0 4px;">
          <div style="color: var(--secondary-color); font-size: 13px; margin-bottom: 6px; padding: 0 16px;">
            来自用户名包含以下关键字的用户的消息将被隐藏（每行一个关键字）
          </div>
          <div style="padding: 0 16px;">
            <textarea
              class="content-filter-textarea"
              value={userKeywords()}
              onInput={onUserKwInput}
              placeholder={'机器人\n营销号\n广告号'}
            />
          </div>
        </div>
      </Section>
    </>
  );
}
