const jwt = require('jsonwebtoken')
const BitrixService = require('./bitrix.service') //ver se pra resolver a dependencia circular, colocar essa parte que ta no service no integration funciona
const UserAccountRepository = require('../repository/userAccount.repository')
const config = require('../config')

const getUrlAuth = async (domainBitrix) => {
	return await BitrixService.getUrlAuth(domainBitrix)
}

const loginOrCreateAccount = async (authCode, scope, domain) => {
	const accessBitrix = await BitrixService.getFinalAccessUrl(authCode, scope, domain)
	const accountExists = await UserAccountRepository.findByUserIdBitrixAndDomain(accessBitrix.user_id, accessBitrix.domain)

	let userData = {}
	if (accountExists) {
		userData = await UserAccountRepository.saveNewAccess(
			accessBitrix.access_token,
			accessBitrix.refresh_token,
			accessBitrix.scope,
			accountExists.id
		)
	} else {
		const bitrixAccessFormatted = {
			fullDomain: accessBitrix.domain,
			accessToken: accessBitrix.access_token,
			refreshToken: accessBitrix.refresh_token
		}
		const [bitrixUserData] = await BitrixService.getBitrixUsersByIds([accessBitrix.user_id], bitrixAccessFormatted)
		const userName = (bitrixUserData.NAME + ' ' + bitrixUserData.LAST_NAME).trim()
		userData = await UserAccountRepository.createAccount(
			accessBitrix.access_token,
			accessBitrix.refresh_token,
			accessBitrix.scope,
			accessBitrix.user_id,
			accessBitrix.domain,
			userName
		)
	}

	const userDataFormatted = {
		userId: userData.id,
		name: userData.username,
		token: jwt.sign(
			{
				userId: userData.id,
				userIdBitrix: userData.user_id_bitrix,
				fullDomain: userData.domain_bitrix
			},
			config.JWT_SECRET_KEY,
			{
				expiresIn: 60 * 60 * config.ETC.KEEP_CONNECTED_HOURS
			}
		)
	}

	return userDataFormatted
}

const getInfoAccount = async (userId) => {
	const user = await UserAccountRepository.getUsersByIds(userId)
	return user[0]
}

module.exports = {
	getUrlAuth,
	loginOrCreateAccount,
	getInfoAccount
}
