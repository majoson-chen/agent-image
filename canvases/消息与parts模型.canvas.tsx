import { Divider, H1, H2, Stack, Table, Text } from 'cursor/canvas'

export default function MessagesPartsCanvas() {
    return (
        <Stack gap={20}>
            <H1>消息与 parts</H1>
            <Text>
                一条消息在库里既有「纯文本摘要」字段，又有一段结构化列表（parts）：时间线上的文字、工具块、状态都靠后者还原。老数据只有纯字也能打开，会自动当成一个文字气泡。
            </Text>

            <H2>用户消息从哪来</H2>
            <Table
                headers={['来源', '含义']}
                rows={[
                    ['你在输入框发的', '随请求同步进库'],
                    ['抓取图像后的旁注', '服务端自动插一条，把说明文字和图片引用对齐，方便以后接着聊'],
                ]}
            />

            <Divider />

            <H2>助手消息怎么长出来</H2>
            <Text>
                模型每走完一小步，就把这一小段拼进 parts（文字一段、工具一块）。要等用户批准的工具，会先停在「已呼叫、结果未出」的形态，批准后下一轮再把结果填回去。
            </Text>

            <Divider />

            <H2>相关画布</H2>
            <Table
                headers={['画布', '内容']}
                rows={[
                    ['AI运行时与聊天接口', '谁在驱动 parts 变长'],
                    ['工具注册与审批', '工具块状态与确认'],
                ]}
            />
        </Stack>
    )
}
