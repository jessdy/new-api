package authz

const (
	ResourceAgentUser       = "agent_user"
	ResourceAgentChannel    = "agent_channel"
	ResourceAgentPricing    = "agent_pricing"
	ResourceAgentModelCost  = "agent_model_cost"
	ResourceAgentPayment    = "agent_payment"
	ResourceAgentSettlement = "agent_settlement"
)

var (
	AgentUserRead       = Permission{Resource: ResourceAgentUser, Action: ActionRead}
	AgentUserWrite      = Permission{Resource: ResourceAgentUser, Action: ActionWrite}
	AgentChannelRead    = Permission{Resource: ResourceAgentChannel, Action: ActionRead}
	AgentChannelWrite   = Permission{Resource: ResourceAgentChannel, Action: ActionWrite}
	AgentPricingRead    = Permission{Resource: ResourceAgentPricing, Action: ActionRead}
	AgentPricingWrite   = Permission{Resource: ResourceAgentPricing, Action: ActionWrite}
	AgentModelCostRead  = Permission{Resource: ResourceAgentModelCost, Action: ActionRead}
	AgentModelCostWrite = Permission{Resource: ResourceAgentModelCost, Action: ActionWrite}
	AgentPaymentRead    = Permission{Resource: ResourceAgentPayment, Action: ActionRead}
	AgentPaymentWrite   = Permission{Resource: ResourceAgentPayment, Action: ActionWrite}
	AgentSettlementRead = Permission{Resource: ResourceAgentSettlement, Action: ActionRead}
)

func init() {
	RegisterResource(ResourceDefinition{
		Resource: ResourceAgentUser,
		LabelKey: "Agent Users",
		Actions: []ActionDefinition{
			{
				Action:         ActionRead,
				LabelKey:       "Read agent users",
				DescriptionKey: "List and view users belonging to the agent.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
			{
				Action:         ActionWrite,
				LabelKey:       "Manage agent users",
				DescriptionKey: "Disable or change groups for users belonging to the agent.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
		},
	})
	RegisterResource(ResourceDefinition{
		Resource: ResourceAgentChannel,
		LabelKey: "Agent Channels",
		Actions: []ActionDefinition{
			{
				Action:         ActionRead,
				LabelKey:       "Read selectable channels",
				DescriptionKey: "View the platform channel pool without secrets and the agent's selected channels.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
			{
				Action:         ActionWrite,
				LabelKey:       "Select agent channels",
				DescriptionKey: "Choose which platform channels the agent may use.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
		},
	})
	RegisterResource(ResourceDefinition{
		Resource: ResourceAgentPricing,
		LabelKey: "Agent Pricing",
		Actions: []ActionDefinition{
			{
				Action:         ActionRead,
				LabelKey:       "Read agent pricing",
				DescriptionKey: "View agent group ratios and model discount prices.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
			{
				Action:         ActionWrite,
				LabelKey:       "Edit agent pricing",
				DescriptionKey: "Configure agent group ratios and model discount prices.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
		},
	})
	RegisterResource(ResourceDefinition{
		Resource: ResourceAgentModelCost,
		LabelKey: "Agent Model Cost",
		Actions: []ActionDefinition{
			{
				Action:         ActionRead,
				LabelKey:       "Read agent model cost",
				DescriptionKey: "View models available under the agent's channels and their upstream cost ratios.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
			{
				Action:         ActionWrite,
				LabelKey:       "Edit agent model cost",
				DescriptionKey: "Set platform-to-agent upstream cost ratios for models. Administrators only.",
				DefaultRoles:   []string{BuiltInRoleAdmin},
			},
		},
	})
	RegisterResource(ResourceDefinition{
		Resource: ResourceAgentPayment,
		LabelKey: "Agent Payment",
		Actions: []ActionDefinition{
			{
				Action:         ActionRead,
				LabelKey:       "Read agent payment settings",
				DescriptionKey: "View masked agent payment gateway settings.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
			{
				Action:         ActionWrite,
				LabelKey:       "Edit agent payment settings",
				DescriptionKey: "Configure the agent's own payment gateway credentials.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
		},
	})
	RegisterResource(ResourceDefinition{
		Resource: ResourceAgentSettlement,
		LabelKey: "Agent Settlement",
		Actions: []ActionDefinition{
			{
				Action:         ActionRead,
				LabelKey:       "Read agent settlement",
				DescriptionKey: "View the agent's settlement debt and bills.",
				DefaultRoles:   []string{BuiltInRoleAgent, BuiltInRoleAdmin},
			},
		},
	})
}
