import {createSignal, onMount, Show} from 'solid-js';
import Section from '@components/section';
import Row from '@components/rowTsx';
import CheckboxFieldTsx from '@components/checkboxFieldTsx';
import {useSuperTab} from '@components/solidJsTabs/superTabProvider';
import {isBlockSponsored, setBlockSponsored} from '@helpers/sponsoredMessages';
import {
  getImageRestrictionEnd,
  getImageRestrictionMode,
  getImageRestrictionStart,
  ImageRestrictionMode,
  isImageRestrictionEnabled,
  setImageRestrictionEnabled,
  setImageRestrictionMode,
  setImageRestrictionSchedule
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
  const [imageRestrictionChecked, setImageRestrictionChecked] = createSignal(isImageRestrictionEnabled());
  const [imageRestrictionMode, setImageRestrictionMode_] = createSignal(getImageRestrictionMode());
  const [imageRestrictionStart, setImageRestrictionStart] = createSignal(getImageRestrictionStart());
  const [imageRestrictionEnd, setImageRestrictionEnd] = createSignal(getImageRestrictionEnd());
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

  const onToggleImageRestriction = (checked: boolean) => {
    setImageRestrictionChecked(checked);
    setImageRestrictionEnabled(checked);
  };

  const selectImageRestrictionMode = (mode: ImageRestrictionMode) => {
    setImageRestrictionMode_(mode);
    setImageRestrictionMode(mode);
  };

  const onImageRestrictionTimeChange = (type: 'start' | 'end', e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    if(type === 'start') setImageRestrictionStart(value);
    else setImageRestrictionEnd(value);
    setImageRestrictionSchedule(
      type === 'start' ? value : imageRestrictionStart(),
      type === 'end' ? value : imageRestrictionEnd()
    );
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

      <Section name={<span>限制图片模式</span>}>
        <div class="profile-buttons">
          <Row>
            <Row.CheckboxFieldToggle>
              <CheckboxFieldTsx
                toggle
                checked={imageRestrictionChecked()}
                onChange={onToggleImageRestriction}
              />
            </Row.CheckboxFieldToggle>
            <Row.Title>限制图片模式</Row.Title>
            <Row.Subtitle>头像使用默认样式，照片和贴纸改为点击加载</Row.Subtitle>
          </Row>
        </div>
        <Show when={imageRestrictionChecked()}>
          <div class="image-restriction-options">
            <div class="image-restriction-mode">
              <span>生效方式</span>
              <div class="image-restriction-segmented">
                <button
                  type="button"
                  classList={{active: imageRestrictionMode() === 'always'}}
                  onClick={() => selectImageRestrictionMode('always')}
                >始终开启</button>
                <button
                  type="button"
                  classList={{active: imageRestrictionMode() === 'scheduled'}}
                  onClick={() => selectImageRestrictionMode('scheduled')}
                >北京时间定时</button>
              </div>
            </div>
            <Show when={imageRestrictionMode() === 'scheduled'}>
              <div class="image-restriction-time-row">
                <label>
                  <span>开始</span>
                  <input
                    type="time"
                    value={imageRestrictionStart()}
                    onChange={[onImageRestrictionTimeChange, 'start']}
                  />
                </label>
                <label>
                  <span>结束</span>
                  <input
                    type="time"
                    value={imageRestrictionEnd()}
                    onChange={[onImageRestrictionTimeChange, 'end']}
                  />
                </label>
              </div>
            </Show>
          </div>
        </Show>
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
