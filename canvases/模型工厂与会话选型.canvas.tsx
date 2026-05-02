import { Divider, H1, H2, Stack, Table, Text } from 'cursor/canvas'

export default function ProvidersSelectionCanvas() {
    return (
        <Stack gap={20}>
            <H1>模型与会话选型</H1>
            <Text>
                「设置」里管**账号**：每种厂商一条记录，带密钥、地址、能力描述。「对话」里管**当下用谁**：语言模型必选一个；主次生图、尺寸可选。每条对话记住自己的当场选择，换会话互不影响。
            </Text>

            <H2>语言模型怎么接上</H2>
            <Table
                headers={['类型（概念）', '说明']}
                rows={[
                    ['官方 OpenAI 形态', '最常见的一种接法'],
                    ['兼容 OpenAI 协议的地址', '自架或第三方网关'],
                    ['阿里云系', '可走额外「思考」开关（若模型配置里声明支持）'],
                ]}
            />

            <Divider />

            <H2>生图怎么接上</H2>
            <Text>
                当前产品支持两条厂商线（火山系、百炼 Wan）：都是「请求 → 拿图 → 落本地库」。超时与用户中断会传进请求里，避免卡住。
            </Text>

            <Divider />

            <H2>能力元数据</H2>
            <Text tone="secondary" size="small">
                每张模型记录上可挂 JSON 能力：例如支持哪些尺寸、参考图几张。界面和工具都从这里读约束，而不是用写死常量代替。
            </Text>

            <Divider />

            <H2>搜索绑定</H2>
            <Text tone="secondary" size="small">
                网页搜与以图搜图可以绑不同账号；密钥只进库，没有「只靠环境变量」的捷径。
            </Text>

            <Divider />

            <H2>相关画布</H2>
            <Table
                headers={['画布', '内容']}
                rows={[
                    ['AI运行时与聊天接口', '选型何时被读进一轮聊天'],
                    ['工具注册与审批', '选型如何变成工具在不在'],
                ]}
            />
        </Stack>
    )
}
