import { Gift, Heart, Link2, Tag } from 'lucide-react';

export const emptyDraft = {
  socialAccountId: '',
  name: '',
  enabled: true,
  mediaScope: 'all',
  mediaIds: [],
  triggerType: 'keywords',
  keywords: [],
  replies: [''],
  sendDm: true,
  dmMessage: '',
};

export const TEMPLATES = [
  {
    id: 'link',
    icon: Link2,
    title: 'Send link in DM',
    description: 'Someone comments "link" → reply publicly and DM them the link.',
    draft: {
      name: 'Send link in DM',
      triggerType: 'keywords',
      keywords: ['link', 'send'],
      replies: ['Sent you a DM {{username}} 📩', 'Check your inbox {{username}}!'],
      sendDm: true,
      dmMessage: "Hey {{username}}! Here's the link you asked for: ",
    },
  },
  {
    id: 'price',
    icon: Tag,
    title: 'Answer price questions',
    description: 'Comments asking about price get the details in a DM.',
    draft: {
      name: 'Price questions',
      triggerType: 'keywords',
      keywords: ['price', 'cost', 'how much'],
      replies: ["Just DM'd you the details {{username}}!"],
      sendDm: true,
      dmMessage: 'Hi {{username}}! Thanks for asking. Here are the prices: ',
    },
  },
  {
    id: 'giveaway',
    icon: Gift,
    title: 'Giveaway entry',
    description: 'Confirm every entry publicly and send the rules by DM.',
    draft: {
      name: 'Giveaway entries',
      triggerType: 'any',
      keywords: [],
      replies: ["You're in {{username}}! 🎉", 'Entry confirmed {{username}}, good luck!'],
      sendDm: true,
      dmMessage: 'Thanks for entering {{username}}! Winners are announced on ',
    },
  },
  {
    id: 'thanks',
    icon: Heart,
    title: 'Thank every commenter',
    description: 'A friendly public reply on every comment. No DM.',
    draft: {
      name: 'Thank commenters',
      triggerType: 'any',
      keywords: [],
      replies: ['Thank you {{username}}! 🙏', 'Appreciate you {{username}} ❤️'],
      sendDm: false,
      dmMessage: '',
    },
  },
];

export const ruleToDraft = (rule) => ({
  socialAccountId: String(rule.socialAccountId),
  name: rule.name,
  enabled: rule.enabled,
  mediaScope: rule.mediaScope,
  mediaIds: rule.mediaIds || [],
  triggerType: rule.triggerType,
  keywords: rule.keywords || [],
  replies: rule.commentReplies?.length ? rule.commentReplies : [''],
  sendDm: rule.sendDm,
  dmMessage: rule.dmMessage || '',
});

export const draftToPayload = (draft) => ({
  socialAccountId: draft.socialAccountId,
  name: draft.name,
  enabled: draft.enabled,
  mediaScope: draft.mediaScope,
  mediaIds: draft.mediaScope === 'specific' ? draft.mediaIds : [],
  triggerType: draft.triggerType,
  keywords: draft.triggerType === 'keywords' ? draft.keywords : [],
  commentReplies: draft.replies.map((reply) => reply.trim()).filter(Boolean),
  sendDm: draft.sendDm,
  dmMessage: draft.sendDm ? draft.dmMessage : '',
});
